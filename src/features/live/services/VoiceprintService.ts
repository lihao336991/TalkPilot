import {
  useConversationStore,
  type VoiceprintDecisionLabel,
  type VoiceprintDecisionReason,
} from '@/features/live/store/conversationStore';
import { useDebugStore } from '@/features/live/store/debugStore';
import {
  voiceEnrollmentService,
  type VoiceEnrollmentProfile,
} from './VoiceEnrollmentService';
import { voiceprintNative } from './VoiceprintNative';

export type VoiceprintDecision = {
  similarity: number | null;
  label: VoiceprintDecisionLabel;
  confidence: 'high' | 'medium' | 'low';
  reason: VoiceprintDecisionReason;
};

const WINDOW_DURATION_MS = 1_500;
const STEP_DURATION_MS = 500;
const DEFAULT_SELF_HIGH_THRESHOLD = 0.58;
const DEFAULT_SELF_LOW_THRESHOLD = 0.38;
const REINFORCE_THRESHOLD = 0.7;
const MAX_BUFFER_WINDOW_MULTIPLIER = 2;

class VoiceprintService {
  private enrollmentProfile: VoiceEnrollmentProfile | null = null;
  private nativeAvailable = false;
  private rollingBytes: number[] = [];
  private bytesSinceLastAnalysis = 0;
  private isAnalyzing = false;
  private sessionActive = false;
  private consecutiveSelf = 0;
  private consecutiveOther = 0;
  private lastEmbedding: number[] | null = null;
  private lastModelInputDurationMs: number | null = null;
  private lastModelMelFrameCount: number | null = null;
  private lastDecision: VoiceprintDecision = {
    similarity: null,
    label: 'unknown',
    confidence: 'low',
    reason: 'profile_unavailable',
  };

  private base64ToBytes(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  private get bytesPerSecond() {
    return voiceEnrollmentService.getPcmFormat().bytesPerSecond;
  }

  private get windowByteLength() {
    return Math.floor((WINDOW_DURATION_MS / 1000) * this.bytesPerSecond);
  }

  private get stepByteLength() {
    return Math.floor((STEP_DURATION_MS / 1000) * this.bytesPerSecond);
  }

  private trimRollingBuffer() {
    const maxBytes = this.windowByteLength * MAX_BUFFER_WINDOW_MULTIPLIER;
    if (this.rollingBytes.length > maxBytes) {
      this.rollingBytes.splice(0, this.rollingBytes.length - maxBytes);
    }
  }

  private updateStoreState() {
    const thresholds = this.getThresholds();
    useConversationStore.getState().setVoiceprintState({
      voiceprintEnabled: this.nativeAvailable,
      voiceprintEnrollmentReady: Boolean(this.enrollmentProfile),
      lastVoiceprintSimilarity: this.lastDecision.similarity,
      lastVoiceprintDecision: this.lastDecision.label,
      lastVoiceprintConfidence: this.lastDecision.confidence,
      lastVoiceprintReason: this.lastDecision.reason,
      lastVoiceprintThresholdHigh: thresholds.high,
      lastVoiceprintThresholdLow: thresholds.low,
      lastVoiceprintInputDurationMs: this.lastModelInputDurationMs,
      lastVoiceprintMelFrameCount: this.lastModelMelFrameCount,
    });
  }

  private updateDecision(decision: VoiceprintDecision) {
    this.lastDecision = decision;
    this.updateStoreState();
  }

  private getThresholds() {
    return {
      high:
        this.enrollmentProfile?.thresholdSelfHigh ?? DEFAULT_SELF_HIGH_THRESHOLD,
      low:
        this.enrollmentProfile?.thresholdSelfLow ?? DEFAULT_SELF_LOW_THRESHOLD,
    };
  }

  private stabilizeLabel(rawLabel: VoiceprintDecisionLabel): VoiceprintDecisionLabel {
    if (rawLabel === 'self') {
      this.consecutiveSelf += 1;
      this.consecutiveOther = 0;
      return this.consecutiveSelf >= 2 ? 'self' : 'unknown';
    }

    if (rawLabel === 'other') {
      this.consecutiveOther += 1;
      this.consecutiveSelf = 0;
      return this.consecutiveOther >= 2 ? 'other' : 'unknown';
    }

    if (this.lastDecision.label === 'self') {
      this.consecutiveOther = 0;
      return 'self';
    }

    if (this.lastDecision.label === 'other') {
      this.consecutiveSelf = 0;
      return 'other';
    }

    this.consecutiveSelf = 0;
    this.consecutiveOther = 0;
    return 'unknown';
  }

  private buildDecision(similarity: number | null): VoiceprintDecision {
    if (!this.nativeAvailable) {
      return {
        similarity,
        label: 'unknown',
        confidence: 'low',
        reason: 'native_unavailable',
      };
    }

    if (!this.enrollmentProfile) {
      return {
        similarity,
        label: 'unknown',
        confidence: 'low',
        reason: 'profile_unavailable',
      };
    }

    if (similarity == null) {
      return {
        similarity,
        label: 'unknown',
        confidence: 'low',
        reason: 'insufficient_audio',
      };
    }

    const { high, low } = this.getThresholds();
    if (similarity >= high) {
      return {
        similarity,
        label: this.stabilizeLabel('self'),
        confidence: 'high',
        reason: 'similarity_high',
      };
    }

    if (similarity <= low) {
      return {
        similarity,
        label: this.stabilizeLabel('other'),
        confidence: 'high',
        reason: 'similarity_low',
      };
    }

    return {
      similarity,
      label: this.stabilizeLabel('unknown'),
      confidence: 'medium',
      reason: 'between_thresholds',
    };
  }

  private async analyzeLatestWindow() {
    if (
      this.isAnalyzing ||
      !this.sessionActive ||
      !this.nativeAvailable ||
      !this.enrollmentProfile ||
      this.rollingBytes.length < this.windowByteLength
    ) {
      return;
    }

    this.isAnalyzing = true;
    try {
      while (
        this.sessionActive &&
        this.nativeAvailable &&
        this.enrollmentProfile &&
        this.rollingBytes.length >= this.windowByteLength &&
        this.bytesSinceLastAnalysis >= this.stepByteLength
      ) {
        const windowBytes = Uint8Array.from(
          this.rollingBytes.slice(this.rollingBytes.length - this.windowByteLength),
        );
        this.bytesSinceLastAnalysis -= this.stepByteLength;

        try {
          const result = await voiceprintNative.compareEmbedding(
            this.bytesToBase64(windowBytes),
            this.enrollmentProfile.embedding,
          );
          this.lastEmbedding = result.embedding ?? null;
          this.lastModelInputDurationMs = result.inputDurationMs ?? null;
          this.lastModelMelFrameCount = result.melFrameCount ?? null;
          this.updateDecision(this.buildDecision(result.similarity));
        } catch (error) {
          console.warn('[VoiceprintService] Failed to analyze window:', error);
          this.lastModelInputDurationMs = null;
          this.lastModelMelFrameCount = null;
          this.updateDecision(this.buildDecision(null));
        }
      }
    } finally {
      this.isAnalyzing = false;
    }
  }

  async hydrateEnrollmentState(): Promise<void> {
    this.nativeAvailable = await voiceprintNative.isAvailable();
    this.enrollmentProfile = await voiceEnrollmentService.loadEnrollmentProfile();
    this.updateDecision(this.buildDecision(null));
  }

  async createEnrollmentProfileFromChunks(
    base64Chunks: string[],
  ): Promise<VoiceEnrollmentProfile> {
    this.nativeAvailable = await voiceprintNative.isAvailable();
    if (!this.nativeAvailable) {
      throw new Error('Voiceprint is unavailable on this device');
    }

    const totalLength = base64Chunks.reduce(
      (sum, chunk) => sum + this.base64ToBytes(chunk).length,
      0,
    );
    const bytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of base64Chunks) {
      const chunkBytes = this.base64ToBytes(chunk);
      bytes.set(chunkBytes, offset);
      offset += chunkBytes.length;
    }

    const base64Pcm = this.bytesToBase64(bytes);
    const embedding = await voiceprintNative.generateEmbedding(base64Pcm);
    const durationMs = Math.round((bytes.length / this.bytesPerSecond) * 1000);
    const profile = voiceEnrollmentService.createProfile({
      embedding,
      durationMs,
    });
    await voiceEnrollmentService.saveEnrollmentProfile(profile);
    this.enrollmentProfile = profile;
    this.updateDecision(this.buildDecision(null));
    return profile;
  }

  async reloadEnrollmentProfile(): Promise<VoiceEnrollmentProfile | null> {
    this.enrollmentProfile = await voiceEnrollmentService.loadEnrollmentProfile();
    this.updateDecision(this.buildDecision(this.lastDecision.similarity));
    return this.enrollmentProfile;
  }

  resetSessionState() {
    this.rollingBytes = [];
    this.bytesSinceLastAnalysis = 0;
    this.isAnalyzing = false;
    this.sessionActive = false;
    this.consecutiveSelf = 0;
    this.consecutiveOther = 0;
    this.lastEmbedding = null;
    this.lastModelInputDurationMs = null;
    this.lastModelMelFrameCount = null;
    this.updateDecision(this.buildDecision(null));
  }

  startSessionAnalysis() {
    this.rollingBytes = [];
    this.bytesSinceLastAnalysis = 0;
    this.isAnalyzing = false;
    this.sessionActive = true;
    this.consecutiveSelf = 0;
    this.consecutiveOther = 0;
    this.lastModelInputDurationMs = null;
    this.lastModelMelFrameCount = null;
    this.updateDecision(this.buildDecision(null));
  }

  stopSessionAnalysis() {
    this.sessionActive = false;
    this.rollingBytes = [];
    this.bytesSinceLastAnalysis = 0;
    this.isAnalyzing = false;
    this.lastModelInputDurationMs = null;
    this.lastModelMelFrameCount = null;
  }

  ingestChunk(base64Chunk: string) {
    if (!this.sessionActive || !this.nativeAvailable || !this.enrollmentProfile) {
      return;
    }

    const bytes = this.base64ToBytes(base64Chunk);
    for (const value of bytes) {
      this.rollingBytes.push(value);
    }
    this.bytesSinceLastAnalysis += bytes.length;
    this.trimRollingBuffer();
    void this.analyzeLatestWindow();
  }

  getCurrentDecision(): VoiceprintDecision {
    return this.lastDecision;
  }

  getEnrollmentProfile(): VoiceEnrollmentProfile | null {
    return this.enrollmentProfile;
  }

  async reinforceEnrollment(options: {
    speaker: 'self' | 'other';
    forcedSpeaker: 'self' | 'other' | null;
  }): Promise<void> {
    if (
      options.speaker !== 'self' ||
      options.forcedSpeaker ||
      !this.enrollmentProfile ||
      !this.lastEmbedding ||
      (this.lastDecision.similarity ?? 0) < REINFORCE_THRESHOLD
    ) {
      return;
    }

    const existing = this.enrollmentProfile.embedding;
    const nextEmbedding = existing.map((value, index) => {
      const incoming = this.lastEmbedding?.[index] ?? value;
      return (0.9 * value) + (0.1 * incoming);
    });
    const normalized = normalizeVector(nextEmbedding);
    this.enrollmentProfile = {
      ...this.enrollmentProfile,
      embedding: normalized,
      createdAt: Date.now(),
    };

    try {
      await voiceEnrollmentService.saveEnrollmentProfile(this.enrollmentProfile);
    } catch (error) {
      console.warn('[VoiceprintService] Failed to persist reinforced profile:', error);
    }
  }
}

function normalizeVector(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + (value * value), 0));
  if (norm <= 1e-6) {
    return values;
  }
  return values.map((value) => value / norm);
}

export const voiceprintService = new VoiceprintService();
