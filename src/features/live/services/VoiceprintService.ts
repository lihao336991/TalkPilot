import {
  useConversationStore,
  type VoiceprintDecisionLabel,
  type VoiceprintDecisionReason,
} from '@/features/live/store/conversationStore';
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

/** Real-time window now exactly 1s = 16,000 samples → hits the native 1s preset with zero padding */
const WINDOW_DURATION_MS = 1_000;
const STEP_DURATION_MS = 500;
export const VOICEPRINT_SELF_HIGH_THRESHOLD = 0.45;
export const VOICEPRINT_SELF_LOW_THRESHOLD = 0.30;
export const VOICEPRINT_STRONG_SELF_THRESHOLD = 0.45;
const REINFORCE_THRESHOLD = 0.65;
const MAX_BUFFER_WINDOW_MULTIPLIER = 3;
const DECISION_WINDOW_SIZE = 5;
const DECISION_MIN_VOTES = 2;

/** Enrollment segment generation: split trimmed audio into 1s windows for same-bucket embedding */
const ENROLLMENT_SEGMENT_MS = 1_000;
const ENROLLMENT_SEGMENT_OVERLAP_MS = 500;

/** VAD energy trimming constants */
const VAD_FRAME_MS = 20;
const VAD_ENERGY_THRESHOLD = 0.005; // RMS energy threshold for speech detection
const VAD_MIN_SPEECH_FRAMES = 10; // Minimum consecutive frames to count as speech
const VAD_PAD_FRAMES = 5; // Pad a few frames before/after speech region

class VoiceprintService {
  private enrollmentProfile: VoiceEnrollmentProfile | null = null;
  private nativeAvailable = false;
  private rollingBytes: number[] = [];
  private bytesSinceLastAnalysis = 0;
  private isAnalyzing = false;
  private sessionActive = false;
  private recentRawLabels: VoiceprintDecisionLabel[] = [];
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
        this.enrollmentProfile?.thresholdSelfHigh ?? VOICEPRINT_SELF_HIGH_THRESHOLD,
      low:
        this.enrollmentProfile?.thresholdSelfLow ?? VOICEPRINT_SELF_LOW_THRESHOLD,
    };
  }

  private stabilizeLabel(
    rawLabel: VoiceprintDecisionLabel,
    similarity: number | null,
  ): VoiceprintDecisionLabel {
    // Strong hits should win immediately instead of waiting for multiple windows.
    if (
      rawLabel === 'self' &&
      similarity != null &&
      similarity >= VOICEPRINT_STRONG_SELF_THRESHOLD
    ) {
      this.recentRawLabels.push('self');
      this.recentRawLabels = this.recentRawLabels.slice(-DECISION_WINDOW_SIZE);
      return 'self';
    }

    this.recentRawLabels.push(rawLabel);
    this.recentRawLabels = this.recentRawLabels.slice(-DECISION_WINDOW_SIZE);

    const selfVotes = this.recentRawLabels.filter((label) => label === 'self').length;
    const otherVotes = this.recentRawLabels.filter((label) => label === 'other').length;

    // Use recent-window majority voting and let unknown act as a neutral vote.
    if (selfVotes >= DECISION_MIN_VOTES && selfVotes > otherVotes) {
      return 'self';
    }

    if (otherVotes >= DECISION_MIN_VOTES && otherVotes > selfVotes) {
      return 'other';
    }

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
        label: this.stabilizeLabel('self', similarity),
        confidence: 'high',
        reason: 'similarity_high',
      };
    }

    if (similarity <= low) {
      return {
        similarity,
        label: this.stabilizeLabel('other', similarity),
        confidence: 'high',
        reason: 'similarity_low',
      };
    }

    return {
      similarity,
      label: this.stabilizeLabel('unknown', similarity),
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
          // #region debug-point A:before-compare
          fetch('http://10.200.152.245:7777/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: 'voiceprint-invalid-enrollment',
              runId: 'pre-fix',
              hypothesisId: 'A',
              location: 'VoiceprintService.ts:analyzeLatestWindow',
              msg: '[DEBUG] about to compare enrollment embedding',
              data: {
                enrollmentLength: this.enrollmentProfile.embedding.length,
                enrollmentPreview: this.enrollmentProfile.embedding.slice(0, 4),
                windowBytes: windowBytes.length,
                nativeAvailable: this.nativeAvailable,
              },
              ts: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          const result = await voiceprintNative.compareEmbedding(
            this.bytesToBase64(windowBytes),
            this.enrollmentProfile.embedding,
          );
          this.lastEmbedding = result.embedding ?? null;
          this.lastModelInputDurationMs = result.inputDurationMs ?? null;
          this.lastModelMelFrameCount = result.melFrameCount ?? null;
          this.updateDecision(this.buildDecision(result.similarity));
        } catch (error) {
          // #region debug-point C:compare-error
          fetch('http://10.200.152.245:7777/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: 'voiceprint-invalid-enrollment',
              runId: 'pre-fix',
              hypothesisId: 'C',
              location: 'VoiceprintService.ts:analyzeLatestWindow',
              msg: '[DEBUG] compareEmbedding failed',
              data: {
                error:
                  error instanceof Error ? error.message : String(error),
                enrollmentLength: this.enrollmentProfile?.embedding.length ?? null,
                enrollmentPreview: this.enrollmentProfile?.embedding.slice(0, 4) ?? null,
              },
              ts: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          console.warn('[VoiceprintService] Failed to analyze window:', error, {
            enrollmentLength: this.enrollmentProfile?.embedding.length ?? null,
            enrollmentPreview:
              this.enrollmentProfile?.embedding.slice(0, 4) ?? null,
            windowBytes: windowBytes.length,
          });
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

  /**
   * Trim leading/trailing silence from PCM bytes using energy-based VAD.
   * Returns a trimmed Uint8Array containing only the speech region.
   */
  private trimSilencePcm(pcmBytes: Uint8Array): Uint8Array {
    const bytesPerSample = 2; // 16-bit PCM
    const samplesPerFrame = Math.floor(
      (VAD_FRAME_MS / 1000) * voiceEnrollmentService.getPcmFormat().sampleRate,
    );
    const totalSamples = Math.floor(pcmBytes.length / bytesPerSample);
    const totalFrames = Math.floor(totalSamples / samplesPerFrame);

    if (totalFrames < VAD_MIN_SPEECH_FRAMES) {
      return pcmBytes; // Too short to trim
    }

    // Compute RMS energy per frame
    const frameEnergies: number[] = [];
    for (let f = 0; f < totalFrames; f++) {
      let sumSquared = 0;
      const startSample = f * samplesPerFrame;
      for (let s = 0; s < samplesPerFrame; s++) {
        const byteOffset = (startSample + s) * bytesPerSample;
        const sample =
          (pcmBytes[byteOffset] | (pcmBytes[byteOffset + 1] << 8)) << 16 >> 16;
        const normalized = sample / 32768;
        sumSquared += normalized * normalized;
      }
      frameEnergies.push(Math.sqrt(sumSquared / samplesPerFrame));
    }

    // Find first and last frames above energy threshold
    let firstSpeechFrame = 0;
    let lastSpeechFrame = totalFrames - 1;

    for (let f = 0; f < totalFrames; f++) {
      if (frameEnergies[f] >= VAD_ENERGY_THRESHOLD) {
        firstSpeechFrame = f;
        break;
      }
    }

    for (let f = totalFrames - 1; f >= 0; f--) {
      if (frameEnergies[f] >= VAD_ENERGY_THRESHOLD) {
        lastSpeechFrame = f;
        break;
      }
    }

    // Pad a few frames before/after
    firstSpeechFrame = Math.max(0, firstSpeechFrame - VAD_PAD_FRAMES);
    lastSpeechFrame = Math.min(totalFrames - 1, lastSpeechFrame + VAD_PAD_FRAMES);

    const startByte = firstSpeechFrame * samplesPerFrame * bytesPerSample;
    const endByte = Math.min(
      (lastSpeechFrame + 1) * samplesPerFrame * bytesPerSample,
      pcmBytes.length,
    );

    console.log(
      `[VoiceprintService] VAD trimmed: ${totalFrames} frames → ` +
        `frames [${firstSpeechFrame}, ${lastSpeechFrame}], ` +
        `${Math.round((endByte - startByte) / this.bytesPerSecond * 1000)}ms of speech`,
    );

    return pcmBytes.slice(startByte, endByte);
  }

  /**
   * Split PCM into overlapping 1s segments and generate an averaged embedding.
   * This ensures enrollment uses the same native 1s preset bucket as real-time analysis.
   * Segments with low energy (silence/pauses) are skipped to avoid polluting the average.
   */
  private async generateAveragedEmbedding(pcmBytes: Uint8Array): Promise<number[]> {
    const segmentBytes = Math.floor(
      (ENROLLMENT_SEGMENT_MS / 1000) * this.bytesPerSecond,
    );
    const stepBytes = Math.floor(
      ((ENROLLMENT_SEGMENT_MS - ENROLLMENT_SEGMENT_OVERLAP_MS) / 1000) *
        this.bytesPerSecond,
    );

    // Collect valid segments (ensure each is exactly 1s for clean preset matching)
    const segments: Uint8Array[] = [];
    let offset = 0;
    while (offset + segmentBytes <= pcmBytes.length) {
      segments.push(pcmBytes.slice(offset, offset + segmentBytes));
      offset += stepBytes;
    }

    if (segments.length === 0) {
      // Fallback: if trimmed audio is shorter than 1s, use the whole thing
      console.warn(
        '[VoiceprintService] Trimmed audio shorter than 1s, using full clip for enrollment',
      );
      return voiceprintNative.generateEmbedding(this.bytesToBase64(pcmBytes));
    }

    // Filter out low-energy segments (likely silence/pauses in the middle)
    const activeSegments = segments.filter((seg) => this.segmentHasSpeech(seg));

    const usableSegments = activeSegments.length > 0 ? activeSegments : segments;
    console.log(
      `[VoiceprintService] Generating enrollment from ${usableSegments.length}/${segments.length} active 1s segments`,
    );

    // Generate embedding for each segment
    const embeddings: number[][] = [];
    for (const segment of usableSegments) {
      try {
        const emb = await voiceprintNative.generateEmbedding(
          this.bytesToBase64(segment),
        );
        if (!isFiniteEmbedding(emb)) {
          console.warn(
            '[VoiceprintService] Segment embedding contains invalid values, skipping',
            { preview: emb.slice(0, 4), length: emb.length },
          );
          continue;
        }
        embeddings.push(emb);
      } catch (error) {
        console.warn('[VoiceprintService] Segment embedding failed, skipping:', error);
      }
    }

    if (embeddings.length === 0) {
      throw new Error('All enrollment segments failed to generate embeddings');
    }

    // Average all embeddings
    const dim = embeddings[0].length;
    const averaged = new Array<number>(dim).fill(0);
    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) {
        averaged[i] += emb[i];
      }
    }
    for (let i = 0; i < dim; i++) {
      averaged[i] /= embeddings.length;
    }

    // Normalize the averaged embedding
    const normalized = normalizeVector(averaged);
    if (!isFiniteEmbedding(normalized)) {
      throw new Error('Enrollment embedding contains invalid values after averaging');
    }
    return normalized;
  }

  /**
   * Check if a PCM segment has enough speech energy to be useful for enrollment.
   * Returns false for segments that are mostly silence.
   */
  private segmentHasSpeech(pcmBytes: Uint8Array): boolean {
    const bytesPerSample = 2;
    const totalSamples = Math.floor(pcmBytes.length / bytesPerSample);
    if (totalSamples === 0) return false;

    // Compute overall RMS of the segment
    let sumSquared = 0;
    for (let i = 0; i < totalSamples; i++) {
      const byteOffset = i * bytesPerSample;
      const sample =
        (pcmBytes[byteOffset] | (pcmBytes[byteOffset + 1] << 8)) << 16 >> 16;
      const normalized = sample / 32768;
      sumSquared += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquared / totalSamples);
    return rms >= VAD_ENERGY_THRESHOLD;
  }

  async createEnrollmentProfileFromChunks(
    base64Chunks: string[],
  ): Promise<VoiceEnrollmentProfile> {
    this.nativeAvailable = await voiceprintNative.isAvailable();
    if (!this.nativeAvailable) {
      throw new Error('Voiceprint is unavailable on this device');
    }

    // 1. Concatenate all chunks
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

    // 2. Trim leading/trailing silence
    const trimmed = this.trimSilencePcm(bytes);

    // 3. Generate averaged embedding from 1s segments (same bucket as real-time)
    const embedding = await this.generateAveragedEmbedding(trimmed);
    // #region debug-point A:create-enrollment-profile
    fetch('http://10.200.152.245:7777/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'voiceprint-invalid-enrollment',
        runId: 'pre-fix',
        hypothesisId: 'A',
        location: 'VoiceprintService.ts:createEnrollmentProfileFromChunks',
        msg: '[DEBUG] generated enrollment embedding',
        data: {
          chunkCount: base64Chunks.length,
          trimmedBytes: trimmed.length,
          embeddingLength: embedding.length,
          preview: embedding.slice(0, 4),
        },
        ts: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const durationMs = Math.round((trimmed.length / this.bytesPerSecond) * 1000);
    const profile = voiceEnrollmentService.createProfile({
      embedding,
      durationMs,
    });
    await voiceEnrollmentService.saveEnrollmentProfile(profile);
    this.enrollmentProfile = profile;
    this.updateDecision(this.buildDecision(null));

    console.log(
      `[VoiceprintService] Enrollment profile created: ${durationMs}ms speech, ` +
        `${embedding.length}D embedding (1s-bucket averaged)`,
      {
        preview: embedding.slice(0, 4),
      },
    );
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
    this.recentRawLabels = [];
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
    this.recentRawLabels = [];
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

function isFiniteEmbedding(values: number[]): boolean {
  return values.every((value) => Number.isFinite(value));
}

export const voiceprintService = new VoiceprintService();
