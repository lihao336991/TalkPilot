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

export type VoiceprintRangeAnalysis = VoiceprintDecision & {
  embedding: number[] | null;
  audioStartMs: number;
  audioEndMs: number;
  analyzedDurationMs: number | null;
  embeddingLatencyMs: number | null;
};

type TimedVoiceprintDecision = VoiceprintDecision & {
  audioStartMs: number;
  audioEndMs: number;
};

type VoiceprintWindowDurationMs = 1_000 | 2_000 | 3_000;

type QueuedAnalysisWindow = {
  bytes: Uint8Array;
  audioEndMs: number;
  durationMs: VoiceprintWindowDurationMs;
};

type AudioHistoryChunk = {
  startMs: number;
  endMs: number;
  bytes: Uint8Array;
};

const ONE_SECOND_WINDOW_DURATION_MS: VoiceprintWindowDurationMs = 1_000;
const TWO_SECOND_WINDOW_DURATION_MS: VoiceprintWindowDurationMs = 2_000;
const THREE_SECOND_WINDOW_DURATION_MS: VoiceprintWindowDurationMs = 3_000;
const ANALYSIS_STEP_DURATION_MS = 500;
export const VOICEPRINT_SELF_HIGH_THRESHOLD = 0.45;
export const VOICEPRINT_SELF_LOW_THRESHOLD = 0.30;
export const VOICEPRINT_STRONG_SELF_THRESHOLD = 0.45;
const REINFORCE_THRESHOLD = 0.65;
const MAX_BUFFER_WINDOW_MULTIPLIER = 3;
const DECISION_WINDOW_SIZE = 5;
const DECISION_MIN_VOTES = 2;
const DECISION_HISTORY_LIMIT = 80;
const AUDIO_HISTORY_LIMIT_MS = 45_000;
const SPEECH_GAP_RESET_MS = 700;
const MIN_SPEECH_RATIO = 0.28;

const ENROLLMENT_SHORT_SEGMENT_OVERLAP_MS = 500;
const ENROLLMENT_MEDIUM_SEGMENT_OVERLAP_MS = 1_000;
const ENROLLMENT_LONG_SEGMENT_OVERLAP_MS = 1_500;

/** VAD energy trimming constants */
const VAD_FRAME_MS = 20;
const VAD_ENERGY_THRESHOLD = 0.005; // RMS energy threshold for speech detection
const VAD_MIN_SPEECH_FRAMES = 10; // Minimum consecutive frames to count as speech
const VAD_PAD_FRAMES = 5; // Pad a few frames before/after speech region

class VoiceprintService {
  private enrollmentProfile: VoiceEnrollmentProfile | null = null;
  private nativeAvailable = false;
  private rollingBytes: number[] = [];
  private audioHistory: AudioHistoryChunk[] = [];
  private bytesSinceLastAnalysis = 0;
  private totalBytesIngested = 0;
  private continuousSpeechMs = 0;
  private lastSpeechAudioEndMs: number | null = null;
  private isAnalyzing = false;
  private sessionActive = false;
  private recentRawLabels: VoiceprintDecisionLabel[] = [];
  private pendingAnalysisWindow: QueuedAnalysisWindow | null = null;
  private decisionHistory: TimedVoiceprintDecision[] = [];
  private lastEmbedding: number[] | null = null;
  private lastAnalysisWindowDurationMs: VoiceprintWindowDurationMs | null = null;
  private lastModelInputDurationMs: number | null = null;
  private lastModelMelFrameCount: number | null = null;
  private lastEmbeddingLatencyMs: number | null = null;
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

  private getWindowByteLength(durationMs: VoiceprintWindowDurationMs) {
    return Math.floor((durationMs / 1000) * this.bytesPerSecond);
  }

  private get analysisStepByteLength() {
    return Math.floor((ANALYSIS_STEP_DURATION_MS / 1000) * this.bytesPerSecond);
  }

  private trimRollingBuffer() {
    const maxBytes =
      this.getWindowByteLength(THREE_SECOND_WINDOW_DURATION_MS) *
      MAX_BUFFER_WINDOW_MULTIPLIER;
    if (this.rollingBytes.length > maxBytes) {
      this.rollingBytes.splice(0, this.rollingBytes.length - maxBytes);
    }
  }

  private appendAudioHistory(bytes: Uint8Array) {
    const startMs = Math.round(
      (this.totalBytesIngested / this.bytesPerSecond) * 1000,
    );
    const endMs = Math.round(
      ((this.totalBytesIngested + bytes.length) / this.bytesPerSecond) * 1000,
    );
    this.audioHistory.push({ startMs, endMs, bytes });

    const minStartMs = Math.max(0, endMs - AUDIO_HISTORY_LIMIT_MS);
    this.audioHistory = this.audioHistory.filter((chunk) => chunk.endMs >= minStartMs);
  }

  private getAudioBytesForRange(startMs: number, endMs: number): Uint8Array | null {
    const normalizedStart = Math.max(0, Math.min(startMs, endMs));
    const normalizedEnd = Math.max(normalizedStart, endMs);
    const slices: Uint8Array[] = [];
    let totalLength = 0;

    for (const chunk of this.audioHistory) {
      if (chunk.endMs <= normalizedStart || chunk.startMs >= normalizedEnd) {
        continue;
      }

      const chunkDurationMs = Math.max(1, chunk.endMs - chunk.startMs);
      const startRatio = Math.max(0, normalizedStart - chunk.startMs) / chunkDurationMs;
      const endRatio = Math.min(chunkDurationMs, normalizedEnd - chunk.startMs) / chunkDurationMs;
      const startByte = Math.max(
        0,
        Math.floor(startRatio * chunk.bytes.length / 2) * 2,
      );
      const endByte = Math.min(
        chunk.bytes.length,
        Math.ceil(endRatio * chunk.bytes.length / 2) * 2,
      );

      if (endByte <= startByte) {
        continue;
      }

      const slice = chunk.bytes.slice(startByte, endByte);
      slices.push(slice);
      totalLength += slice.length;
    }

    if (totalLength === 0) {
      return null;
    }

    const bytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const slice of slices) {
      bytes.set(slice, offset);
      offset += slice.length;
    }
    return bytes;
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
      lastVoiceprintEmbeddingLatencyMs: this.lastEmbeddingLatencyMs,
    });
  }

  private updateDecision(decision: VoiceprintDecision) {
    this.lastDecision = decision;
    this.updateStoreState();
  }

  private recordTimedDecision(
    decision: VoiceprintDecision,
    audioEndMs: number,
    durationMs: VoiceprintWindowDurationMs,
  ) {
    const timedDecision: TimedVoiceprintDecision = {
      ...decision,
      audioStartMs: Math.max(0, audioEndMs - durationMs),
      audioEndMs,
    };
    this.decisionHistory = [
      ...this.decisionHistory,
      timedDecision,
    ].slice(-DECISION_HISTORY_LIMIT);
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

  private buildRawDecision(similarity: number | null): VoiceprintDecision {
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
        label: 'self',
        confidence: 'high',
        reason: 'similarity_high',
      };
    }

    if (similarity <= low) {
      return {
        similarity,
        label: 'other',
        confidence: 'high',
        reason: 'similarity_low',
      };
    }

    return {
      similarity,
      label: 'unknown',
      confidence: 'medium',
      reason: 'between_thresholds',
    };
  }

  private buildDecision(similarity: number | null): VoiceprintDecision {
    const rawDecision = this.buildRawDecision(similarity);
    return {
      ...rawDecision,
      label: this.stabilizeLabel(rawDecision.label, rawDecision.similarity),
    };
  }

  private getEnrollmentEmbeddingForDuration(
    durationMs: VoiceprintWindowDurationMs,
  ): number[] | null {
    if (!this.enrollmentProfile) {
      return null;
    }
    return this.enrollmentProfile.embeddingsByDurationMs[String(durationMs)] ?? null;
  }

  private getAnalysisDurationForBytes(bytes: Uint8Array): VoiceprintWindowDurationMs | null {
    const durationMs = Math.round((bytes.length / this.bytesPerSecond) * 1000);
    if (durationMs >= THREE_SECOND_WINDOW_DURATION_MS) {
      return THREE_SECOND_WINDOW_DURATION_MS;
    }
    if (durationMs >= TWO_SECOND_WINDOW_DURATION_MS) {
      return TWO_SECOND_WINDOW_DURATION_MS;
    }
    if (durationMs >= ONE_SECOND_WINDOW_DURATION_MS) {
      return ONE_SECOND_WINDOW_DURATION_MS;
    }
    return null;
  }

  private getLatestWindowBytes(
    bytes: Uint8Array,
    durationMs: VoiceprintWindowDurationMs,
  ): Uint8Array {
    const windowLength = this.getWindowByteLength(durationMs);
    if (bytes.length <= windowLength) {
      return bytes;
    }
    return bytes.slice(bytes.length - windowLength);
  }

  getSimilarityThresholds() {
    return this.getThresholds();
  }

  private async analyzeLatestWindow() {
    if (this.isAnalyzing) {
      return;
    }

    this.isAnalyzing = true;
    try {
      while (
        this.sessionActive &&
        this.nativeAvailable &&
        this.enrollmentProfile &&
        this.pendingAnalysisWindow
      ) {
        const analysisWindow = this.pendingAnalysisWindow;
        this.pendingAnalysisWindow = null;
        if (!analysisWindow) {
          break;
        }

        try {
          const enrollmentEmbedding = this.getEnrollmentEmbeddingForDuration(
            analysisWindow.durationMs,
          );
          if (!enrollmentEmbedding) {
            throw new Error('Enrollment embedding unavailable for analysis window');
          }
          const embeddingStartedAt = Date.now();
          const result = await voiceprintNative.compareEmbedding(
            this.bytesToBase64(analysisWindow.bytes),
            enrollmentEmbedding,
          );
          const embeddingLatencyMs = Date.now() - embeddingStartedAt;
          this.lastEmbedding = result.embedding ?? null;
          this.lastAnalysisWindowDurationMs = analysisWindow.durationMs;
          this.lastModelInputDurationMs = result.inputDurationMs ?? null;
          this.lastModelMelFrameCount = result.melFrameCount ?? null;
          this.lastEmbeddingLatencyMs = embeddingLatencyMs;
          const decision = this.buildDecision(result.similarity);
          console.log('[VoiceprintService] Window embedding analyzed', {
            durationMs: analysisWindow.durationMs,
            latencyMs: embeddingLatencyMs,
            similarity: Number.isFinite(result.similarity)
              ? Number(result.similarity.toFixed(3))
              : result.similarity,
            decision: decision.label,
          });
          this.updateDecision(decision);
          this.recordTimedDecision(
            decision,
            analysisWindow.audioEndMs,
            analysisWindow.durationMs,
          );
        } catch (error) {
          console.warn('[VoiceprintService] Failed to analyze window:', error, {
            enrollmentLength: this.enrollmentProfile?.embedding.length ?? null,
            enrollmentPreview:
              this.enrollmentProfile?.embedding.slice(0, 4) ?? null,
            windowBytes: analysisWindow.bytes.length,
            windowAudioEndMs: analysisWindow.audioEndMs,
            windowDurationMs: analysisWindow.durationMs,
          });
          this.lastModelInputDurationMs = null;
          this.lastAnalysisWindowDurationMs = null;
          this.lastModelMelFrameCount = null;
          this.lastEmbeddingLatencyMs = null;
          const decision = this.buildDecision(null);
          this.updateDecision(decision);
        }
      }
    } finally {
      this.isAnalyzing = false;
    }
  }

  private queueLatestAnalysisWindow(window: QueuedAnalysisWindow) {
    this.pendingAnalysisWindow = window;
  }

  private enqueueAnalysisWindows() {
    if (
      !this.sessionActive ||
      !this.nativeAvailable ||
      !this.enrollmentProfile
    ) {
      return;
    }

    while (
      this.bytesSinceLastAnalysis >= this.analysisStepByteLength &&
      this.rollingBytes.length >= this.getWindowByteLength(ONE_SECOND_WINDOW_DURATION_MS)
    ) {
      const oneSecondBytes = Uint8Array.from(
        this.rollingBytes.slice(
          this.rollingBytes.length -
            this.getWindowByteLength(ONE_SECOND_WINDOW_DURATION_MS),
        ),
      );
      const audioEndMs = Math.round(
        (this.totalBytesIngested / this.bytesPerSecond) * 1000,
      );
      const hasSpeech = this.segmentHasSpeech(oneSecondBytes);

      if (hasSpeech) {
        if (
          this.lastSpeechAudioEndMs == null ||
          audioEndMs - this.lastSpeechAudioEndMs > SPEECH_GAP_RESET_MS
        ) {
          this.continuousSpeechMs = ONE_SECOND_WINDOW_DURATION_MS;
        } else {
          this.continuousSpeechMs = Math.min(
            THREE_SECOND_WINDOW_DURATION_MS,
            this.continuousSpeechMs + ANALYSIS_STEP_DURATION_MS,
          );
        }
        this.lastSpeechAudioEndMs = audioEndMs;
      } else if (
        this.lastSpeechAudioEndMs != null &&
        audioEndMs - this.lastSpeechAudioEndMs > SPEECH_GAP_RESET_MS
      ) {
        this.continuousSpeechMs = 0;
      }

      if (hasSpeech && this.continuousSpeechMs >= ONE_SECOND_WINDOW_DURATION_MS) {
        const durationMs = this.getAdaptiveWindowDurationMs();
        const windowByteLength = this.getWindowByteLength(durationMs);
        if (this.rollingBytes.length >= windowByteLength) {
          const bytes = Uint8Array.from(
            this.rollingBytes.slice(this.rollingBytes.length - windowByteLength),
          );
          this.queueLatestAnalysisWindow({ bytes, audioEndMs, durationMs });
        }
      }

      this.bytesSinceLastAnalysis -= this.analysisStepByteLength;
    }
  }

  private getAdaptiveWindowDurationMs(): VoiceprintWindowDurationMs {
    if (this.continuousSpeechMs >= THREE_SECOND_WINDOW_DURATION_MS) {
      return THREE_SECOND_WINDOW_DURATION_MS;
    }
    if (this.continuousSpeechMs >= TWO_SECOND_WINDOW_DURATION_MS) {
      return TWO_SECOND_WINDOW_DURATION_MS;
    }
    return ONE_SECOND_WINDOW_DURATION_MS;
  }

  async hydrateEnrollmentState(): Promise<void> {
    this.nativeAvailable = await voiceprintNative.isAvailable();
    this.enrollmentProfile = await voiceEnrollmentService.loadEnrollmentProfile();
    if (!this.enrollmentProfile && this.nativeAvailable) {
      const enrollmentChunks = await voiceEnrollmentService.loadEnrollmentChunks();
      if (enrollmentChunks.length > 0) {
        try {
          this.enrollmentProfile =
            await this.createEnrollmentProfileFromChunks(enrollmentChunks);
        } catch (error) {
          console.warn(
            '[VoiceprintService] Failed to migrate enrollment profile:',
            error,
          );
        }
      }
    }
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
   * Split PCM into overlapping segments and generate an averaged embedding.
   * This ensures enrollment uses the same native preset bucket as real-time analysis.
   * Segments with low energy (silence/pauses) are skipped to avoid polluting the average.
   */
  private async generateAveragedEmbedding(
    pcmBytes: Uint8Array,
    segmentMs: VoiceprintWindowDurationMs,
    overlapMs: number,
  ): Promise<number[]> {
    const segmentBytes = Math.floor((segmentMs / 1000) * this.bytesPerSecond);
    const stepBytes = Math.floor(
      ((segmentMs - overlapMs) / 1000) * this.bytesPerSecond,
    );

    // Collect valid segments (ensure each is exactly the target duration for clean preset matching)
    const segments: Uint8Array[] = [];
    let offset = 0;
    while (offset + segmentBytes <= pcmBytes.length) {
      segments.push(pcmBytes.slice(offset, offset + segmentBytes));
      offset += stepBytes;
    }

    if (segments.length === 0) {
      // Fallback: if trimmed audio is shorter than the target, use the whole thing
      console.warn(
        `[VoiceprintService] Trimmed audio shorter than ${segmentMs}ms, using full clip for enrollment`,
      );
      return voiceprintNative.generateEmbedding(this.bytesToBase64(pcmBytes));
    }

    // Filter out low-energy segments (likely silence/pauses in the middle)
    const activeSegments = segments.filter((seg) =>
      this.segmentHasSpeech(seg, MIN_SPEECH_RATIO),
    );

    const usableSegments = activeSegments.length > 0 ? activeSegments : segments;
    console.log(
      `[VoiceprintService] Generating enrollment from ${usableSegments.length}/${segments.length} active ${segmentMs}ms segments`,
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
  private segmentHasSpeech(
    pcmBytes: Uint8Array,
    minSpeechRatio = 0.12,
  ): boolean {
    const bytesPerSample = 2;
    const totalSamples = Math.floor(pcmBytes.length / bytesPerSample);
    if (totalSamples === 0) return false;

    const samplesPerFrame = Math.floor(
      (VAD_FRAME_MS / 1000) * voiceEnrollmentService.getPcmFormat().sampleRate,
    );
    const totalFrames = Math.floor(totalSamples / samplesPerFrame);
    if (totalFrames === 0) return false;

    let speechFrames = 0;
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
      const rms = Math.sqrt(sumSquared / samplesPerFrame);
      if (rms >= VAD_ENERGY_THRESHOLD) {
        speechFrames += 1;
      }
    }

    return speechFrames / totalFrames >= minSpeechRatio;
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

    // 3. Generate averaged embeddings for each adaptive real-time bucket.
    const embeddingOneSecond = await this.generateAveragedEmbedding(
      trimmed,
      ONE_SECOND_WINDOW_DURATION_MS,
      ENROLLMENT_SHORT_SEGMENT_OVERLAP_MS,
    );
    const embeddingTwoSecond = await this.generateAveragedEmbedding(
      trimmed,
      TWO_SECOND_WINDOW_DURATION_MS,
      ENROLLMENT_MEDIUM_SEGMENT_OVERLAP_MS,
    );
    const embeddingThreeSecond = await this.generateAveragedEmbedding(
      trimmed,
      THREE_SECOND_WINDOW_DURATION_MS,
      ENROLLMENT_LONG_SEGMENT_OVERLAP_MS,
    );
    const embedding = embeddingThreeSecond;

    const durationMs = Math.round((trimmed.length / this.bytesPerSecond) * 1000);
    const profile = voiceEnrollmentService.createProfile({
      embedding,
      embeddingsByDurationMs: {
        [String(ONE_SECOND_WINDOW_DURATION_MS)]: embeddingOneSecond,
        [String(TWO_SECOND_WINDOW_DURATION_MS)]: embeddingTwoSecond,
        [String(THREE_SECOND_WINDOW_DURATION_MS)]: embeddingThreeSecond,
      },
      durationMs,
    });
    await voiceEnrollmentService.saveEnrollmentProfile(profile);
    this.enrollmentProfile = profile;
    this.updateDecision(this.buildDecision(null));

    console.log(
      `[VoiceprintService] Enrollment profile created: ${durationMs}ms speech, ` +
        `${embedding.length}D embedding (adaptive-window averaged)`,
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
    this.audioHistory = [];
    this.bytesSinceLastAnalysis = 0;
    this.totalBytesIngested = 0;
    this.continuousSpeechMs = 0;
    this.lastSpeechAudioEndMs = null;
    this.isAnalyzing = false;
    this.sessionActive = false;
    this.recentRawLabels = [];
    this.pendingAnalysisWindow = null;
    this.decisionHistory = [];
    this.lastEmbedding = null;
    this.lastAnalysisWindowDurationMs = null;
    this.lastModelInputDurationMs = null;
    this.lastModelMelFrameCount = null;
    this.lastEmbeddingLatencyMs = null;
    this.updateDecision(this.buildDecision(null));
  }

  startSessionAnalysis() {
    this.rollingBytes = [];
    this.audioHistory = [];
    this.bytesSinceLastAnalysis = 0;
    this.totalBytesIngested = 0;
    this.continuousSpeechMs = 0;
    this.lastSpeechAudioEndMs = null;
    this.isAnalyzing = false;
    this.sessionActive = true;
    this.recentRawLabels = [];
    this.pendingAnalysisWindow = null;
    this.decisionHistory = [];
    this.lastEmbedding = null;
    this.lastAnalysisWindowDurationMs = null;
    this.lastModelInputDurationMs = null;
    this.lastModelMelFrameCount = null;
    this.lastEmbeddingLatencyMs = null;
    this.updateDecision(this.buildDecision(null));
  }

  stopSessionAnalysis() {
    this.sessionActive = false;
    this.rollingBytes = [];
    this.audioHistory = [];
    this.bytesSinceLastAnalysis = 0;
    this.totalBytesIngested = 0;
    this.continuousSpeechMs = 0;
    this.lastSpeechAudioEndMs = null;
    this.isAnalyzing = false;
    this.pendingAnalysisWindow = null;
    this.decisionHistory = [];
    this.lastEmbedding = null;
    this.lastAnalysisWindowDurationMs = null;
    this.lastModelInputDurationMs = null;
    this.lastModelMelFrameCount = null;
    this.lastEmbeddingLatencyMs = null;
  }

  ingestChunk(base64Chunk: string) {
    if (!this.sessionActive || !this.nativeAvailable || !this.enrollmentProfile) {
      return;
    }

    const bytes = this.base64ToBytes(base64Chunk);
    this.appendAudioHistory(bytes);
    for (const value of bytes) {
      this.rollingBytes.push(value);
    }
    this.bytesSinceLastAnalysis += bytes.length;
    this.totalBytesIngested += bytes.length;
    this.trimRollingBuffer();
    this.enqueueAnalysisWindows();
    void this.analyzeLatestWindow();
  }

  async analyzeAudioRange(
    startMs: number | null,
    endMs: number | null,
  ): Promise<VoiceprintRangeAnalysis | null> {
    if (
      startMs == null ||
      endMs == null ||
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs)
    ) {
      return null;
    }

    const normalizedStart = Math.max(0, Math.min(startMs, endMs));
    const normalizedEnd = Math.max(normalizedStart, endMs);
    if (!this.sessionActive || !this.nativeAvailable || !this.enrollmentProfile) {
      return {
        ...this.buildRawDecision(null),
        embedding: null,
        audioStartMs: normalizedStart,
        audioEndMs: normalizedEnd,
        analyzedDurationMs: null,
        embeddingLatencyMs: null,
      };
    }

    const rangeBytes = this.getAudioBytesForRange(normalizedStart, normalizedEnd);
    if (!rangeBytes) {
      return null;
    }

    const speechBytes = this.trimSilencePcm(rangeBytes);
    const durationMs = this.getAnalysisDurationForBytes(speechBytes);
    if (!durationMs) {
      const decision = this.buildRawDecision(null);
      return {
        ...decision,
        embedding: null,
        audioStartMs: normalizedStart,
        audioEndMs: normalizedEnd,
        analyzedDurationMs: null,
        embeddingLatencyMs: null,
      };
    }

    const enrollmentEmbedding = this.getEnrollmentEmbeddingForDuration(durationMs);
    if (!enrollmentEmbedding) {
      return {
        ...this.buildRawDecision(null),
        embedding: null,
        audioStartMs: normalizedStart,
        audioEndMs: normalizedEnd,
        analyzedDurationMs: durationMs,
        embeddingLatencyMs: null,
      };
    }

    const analysisBytes = this.getLatestWindowBytes(speechBytes, durationMs);
    const embeddingStartedAt = Date.now();
    const result = await voiceprintNative.compareEmbedding(
      this.bytesToBase64(analysisBytes),
      enrollmentEmbedding,
    );
    const embeddingLatencyMs = Date.now() - embeddingStartedAt;
    const decision = this.buildRawDecision(result.similarity);

    this.lastEmbedding = result.embedding ?? null;
    this.lastAnalysisWindowDurationMs = durationMs;
    this.lastModelInputDurationMs = result.inputDurationMs ?? null;
    this.lastModelMelFrameCount = result.melFrameCount ?? null;
    this.lastEmbeddingLatencyMs = embeddingLatencyMs;
    this.updateStoreState();

    console.log('[VoiceprintService] Range embedding analyzed', {
      rangeMs: `${Math.round(normalizedStart)}-${Math.round(normalizedEnd)}`,
      durationMs,
      latencyMs: embeddingLatencyMs,
      similarity: Number.isFinite(result.similarity)
        ? Number(result.similarity.toFixed(3))
        : result.similarity,
      decision: decision.label,
    });

    return {
      ...decision,
      embedding: result.embedding ?? null,
      audioStartMs: normalizedStart,
      audioEndMs: normalizedEnd,
      analyzedDurationMs: durationMs,
      embeddingLatencyMs,
    };
  }

  getCurrentDecision(): VoiceprintDecision {
    return this.lastDecision;
  }

  getDecisionForAudioRange(startMs: number | null, endMs: number | null): VoiceprintDecision {
    if (
      startMs == null ||
      endMs == null ||
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs)
    ) {
      return this.lastDecision;
    }

    const normalizedStart = Math.max(0, Math.min(startMs, endMs));
    const normalizedEnd = Math.max(normalizedStart, endMs);
    const candidates = this.decisionHistory.filter(
      (decision) =>
        decision.audioEndMs >= normalizedStart &&
        decision.audioStartMs <= normalizedEnd,
    );

    if (candidates.length === 0) {
      return this.lastDecision;
    }

    return candidates.reduce((best, current) => {
      const bestSimilarity = best.similarity ?? Number.NEGATIVE_INFINITY;
      const currentSimilarity = current.similarity ?? Number.NEGATIVE_INFINITY;
      return currentSimilarity > bestSimilarity ? current : best;
    });
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

    const incoming = this.lastEmbedding;
    const durationKey = String(
      this.lastAnalysisWindowDurationMs ?? ONE_SECOND_WINDOW_DURATION_MS,
    );
    const existing =
      this.enrollmentProfile.embeddingsByDurationMs[durationKey] ??
      this.enrollmentProfile.embedding;
    const nextEmbedding = existing.map((value, index) => {
      const incomingValue = incoming[index] ?? value;
      return (0.9 * value) + (0.1 * incomingValue);
    });
    const normalized = normalizeVector(nextEmbedding);
    const nextEmbeddingsByDurationMs = {
      ...this.enrollmentProfile.embeddingsByDurationMs,
      [durationKey]: normalized,
    };
    const canonicalEmbedding =
      durationKey === String(THREE_SECOND_WINDOW_DURATION_MS)
        ? normalized
        : this.enrollmentProfile.embedding;

    this.enrollmentProfile = {
      ...this.enrollmentProfile,
      embedding: canonicalEmbedding,
      embeddingsByDurationMs: nextEmbeddingsByDurationMs,
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
