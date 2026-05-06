import * as FileSystem from 'expo-file-system/legacy';

const ENROLLMENT_FILE_PATH = `${FileSystem.documentDirectory}voice_enrollment.pcm`;
const ENROLLMENT_PLAYBACK_FILE_PATH = `${FileSystem.cacheDirectory}voice_enrollment.wav`;
const ENROLLMENT_PROFILE_FILE_PATH = `${FileSystem.documentDirectory}voice_enrollment_profile.json`;
const ENROLLMENT_DURATION_MS = 5_000;
const SAMPLE_RATE = 16_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const ENROLLMENT_PROFILE_VERSION = 1;
const VOICEPRINT_MODEL = 'titanet-small-f16-coreml-v5-adaptive-window';
const DEFAULT_TITANET_SELF_HIGH_THRESHOLD = 0.58;
const DEFAULT_TITANET_SELF_LOW_THRESHOLD = 0.38;

function isFiniteEmbeddingArray(values: unknown[]): values is number[] {
  return values.every(
    (value) => typeof value === 'number' && Number.isFinite(value),
  );
}

export type EnrollmentStatus = 'idle' | 'recording' | 'done';

export type VoiceEnrollmentProfile = {
  version: number;
  createdAt: number;
  sampleRate: number;
  durationMs: number;
  embedding: number[];
  embeddingsByDurationMs: Record<string, number[]>;
  model: string;
  thresholdSelfHigh: number;
  thresholdSelfLow: number;
};

export type EnrollmentAvailability =
  | 'missing'
  | 'legacy_pcm_only'
  | 'ready';

/**
 * Manages a persisted PCM audio sample used to prime Deepgram speaker diarization.
 * The sample is recorded once and reused across sessions so the user's speaker ID
 * can be locked before the live mic opens.
 */
class VoiceEnrollmentService {
  private cachedAvailability: EnrollmentAvailability | null = null;
  private cachedPcmBase64: string | null | undefined = undefined;
  private cachedChunks: string[] | null = null;
  private inflightPrewarmPromise: Promise<void> | null = null;

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

  private splitBase64IntoChunks(base64: string): string[] {
    if (!base64) {
      return [];
    }

    // Split into ~64KB chunks to match AudioEngine buffer cadence
    const chunkSize = 87380; // ~64KB in base64 chars
    const chunks: string[] = [];
    for (let i = 0; i < base64.length; i += chunkSize) {
      chunks.push(base64.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private setCachedPcmBase64(base64: string | null) {
    this.cachedPcmBase64 = base64;
    this.cachedChunks = base64 ? this.splitBase64IntoChunks(base64) : [];
  }

  private async readEnrollmentPcmBase64(): Promise<string | null> {
    try {
      const base64 = await FileSystem.readAsStringAsync(ENROLLMENT_FILE_PATH, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64 || null;
    } catch {
      return null;
    }
  }

  private createWavHeader(pcmByteLength: number): Uint8Array {
    const blockAlign = (CHANNELS * BITS_PER_SAMPLE) / 8;
    const byteRate = SAMPLE_RATE * blockAlign;
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    const writeAscii = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i += 1) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    };

    writeAscii(0, 'RIFF');
    view.setUint32(4, 36 + pcmByteLength, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, CHANNELS, true);
    view.setUint32(24, SAMPLE_RATE, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, BITS_PER_SAMPLE, true);
    writeAscii(36, 'data');
    view.setUint32(40, pcmByteLength, true);

    return new Uint8Array(buffer);
  }

  async hasEnrollment(): Promise<boolean> {
    const availability = await this.getEnrollmentAvailability();
    return availability === 'ready';
  }

  async getEnrollmentAvailability(): Promise<EnrollmentAvailability> {
    if (this.cachedAvailability) {
      return this.cachedAvailability;
    }

    try {
      const pcmInfo = await FileSystem.getInfoAsync(ENROLLMENT_FILE_PATH);
      const hasPcm = pcmInfo.exists && Number((pcmInfo as any).size ?? 0) > 0;
      if (!hasPcm) {
        this.cachedAvailability = 'missing';
        this.setCachedPcmBase64(null);
        return this.cachedAvailability;
      }

      const profile = await this.loadEnrollmentProfile();
      this.cachedAvailability = profile ? 'ready' : 'legacy_pcm_only';
      return this.cachedAvailability;
    } catch {
      this.cachedAvailability = 'missing';
      this.setCachedPcmBase64(null);
      return 'missing';
    }
  }

  async saveEnrollment(base64Chunks: string[]): Promise<void> {
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

    await FileSystem.writeAsStringAsync(ENROLLMENT_FILE_PATH, this.bytesToBase64(bytes), {
      encoding: FileSystem.EncodingType.Base64,
    });
    this.setCachedPcmBase64(this.bytesToBase64(bytes));
    this.cachedAvailability = 'legacy_pcm_only';
    console.log('[VoiceEnrollment] Saved enrollment audio');
  }

  async loadEnrollmentChunks(): Promise<string[]> {
    if (this.cachedChunks) {
      return this.cachedChunks;
    }

    const base64 = await this.loadEnrollmentPcmBase64();
    const chunks = base64 ? this.splitBase64IntoChunks(base64) : [];
    this.cachedChunks = chunks;
    return chunks;
  }

  async loadEnrollmentPcmBase64(): Promise<string | null> {
    if (this.cachedPcmBase64 !== undefined) {
      return this.cachedPcmBase64;
    }

    const base64 = await this.readEnrollmentPcmBase64();
    this.setCachedPcmBase64(base64);
    return base64;
  }

  async saveEnrollmentProfile(profile: VoiceEnrollmentProfile): Promise<void> {
    console.log('[VoiceEnrollmentService] Saving enrollment profile', {
      model: profile.model,
      embeddingLength: profile.embedding.length,
      preview: profile.embedding.slice(0, 4),
    });
    await FileSystem.writeAsStringAsync(
      ENROLLMENT_PROFILE_FILE_PATH,
      JSON.stringify(profile),
      { encoding: FileSystem.EncodingType.UTF8 },
    );
    this.cachedAvailability = 'ready';
  }

  async loadEnrollmentProfile(): Promise<VoiceEnrollmentProfile | null> {
    try {
      const raw = await FileSystem.readAsStringAsync(ENROLLMENT_PROFILE_FILE_PATH, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<VoiceEnrollmentProfile>;
      console.log('[VoiceEnrollmentService] Loaded enrollment profile', {
        parsedModel: parsed.model ?? null,
        embeddingLength: Array.isArray(parsed.embedding)
          ? parsed.embedding.length
          : null,
        embeddingDurations: parsed.embeddingsByDurationMs
          ? Object.keys(parsed.embeddingsByDurationMs)
          : [],
        preview: Array.isArray(parsed.embedding)
          ? parsed.embedding.slice(0, 4)
          : null,
      });
      if (
        parsed.version !== ENROLLMENT_PROFILE_VERSION ||
        parsed.model !== VOICEPRINT_MODEL ||
        !Array.isArray(parsed.embedding) ||
        !parsed.embeddingsByDurationMs ||
        typeof parsed.embeddingsByDurationMs !== 'object' ||
        parsed.embedding.length === 0 ||
        !Array.isArray(parsed.embeddingsByDurationMs['1000']) ||
        !Array.isArray(parsed.embeddingsByDurationMs['2000']) ||
        !Array.isArray(parsed.embeddingsByDurationMs['3000']) ||
        !isFiniteEmbeddingArray(parsed.embedding) ||
        !isFiniteEmbeddingArray(parsed.embeddingsByDurationMs['1000']) ||
        !isFiniteEmbeddingArray(parsed.embeddingsByDurationMs['2000']) ||
        !isFiniteEmbeddingArray(parsed.embeddingsByDurationMs['3000'])
      ) {
        return null;
      }

      return {
        version: parsed.version,
        createdAt: parsed.createdAt ?? Date.now(),
        sampleRate: parsed.sampleRate ?? SAMPLE_RATE,
        durationMs: parsed.durationMs ?? ENROLLMENT_DURATION_MS,
        embedding: parsed.embedding,
        embeddingsByDurationMs: parsed.embeddingsByDurationMs,
        model: parsed.model,
        thresholdSelfHigh:
          parsed.thresholdSelfHigh ?? DEFAULT_TITANET_SELF_HIGH_THRESHOLD,
        thresholdSelfLow:
          parsed.thresholdSelfLow ?? DEFAULT_TITANET_SELF_LOW_THRESHOLD,
      };
    } catch {
      return null;
    }
  }

  async hasEnrollmentProfile(): Promise<boolean> {
    return (await this.loadEnrollmentProfile()) !== null;
  }

  async clearEnrollmentProfile(): Promise<void> {
    try {
      const info = await FileSystem.getInfoAsync(ENROLLMENT_PROFILE_FILE_PATH);
      if (info.exists) {
        await FileSystem.deleteAsync(ENROLLMENT_PROFILE_FILE_PATH);
      }
    } catch {
      // ignore
    }
    this.cachedAvailability =
      this.cachedPcmBase64 && this.cachedPcmBase64.length > 0
        ? 'legacy_pcm_only'
        : 'missing';
  }

  async clearEnrollment(): Promise<void> {
    try {
      const info = await FileSystem.getInfoAsync(ENROLLMENT_FILE_PATH);
      if (info.exists) {
        await FileSystem.deleteAsync(ENROLLMENT_FILE_PATH);
      }
      const playbackInfo = await FileSystem.getInfoAsync(ENROLLMENT_PLAYBACK_FILE_PATH);
      if (playbackInfo.exists) {
        await FileSystem.deleteAsync(ENROLLMENT_PLAYBACK_FILE_PATH);
      }
    } catch {
      // ignore
    }
    this.cachedAvailability = 'missing';
    this.setCachedPcmBase64(null);
    await this.clearEnrollmentProfile();
    console.log('[VoiceEnrollment] Cleared enrollment audio');
  }

  async prewarm(): Promise<void> {
    if (this.inflightPrewarmPromise) {
      return this.inflightPrewarmPromise;
    }

    this.inflightPrewarmPromise = (async () => {
      const [base64, profile] = await Promise.all([
        this.loadEnrollmentPcmBase64(),
        this.loadEnrollmentProfile(),
      ]);
      if (!base64) {
        this.cachedAvailability = 'missing';
        return;
      }

      this.cachedAvailability = profile ? 'ready' : 'legacy_pcm_only';
    })().finally(() => {
      this.inflightPrewarmPromise = null;
    });

    return this.inflightPrewarmPromise;
  }

  async preparePlaybackUri(): Promise<string | null> {
    try {
      const base64 = await FileSystem.readAsStringAsync(ENROLLMENT_FILE_PATH, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!base64) {
        return null;
      }

      const pcmBytes = this.base64ToBytes(base64);
      const wavHeader = this.createWavHeader(pcmBytes.length);
      const wavBytes = new Uint8Array(wavHeader.length + pcmBytes.length);
      wavBytes.set(wavHeader, 0);
      wavBytes.set(pcmBytes, wavHeader.length);

      await FileSystem.writeAsStringAsync(
        ENROLLMENT_PLAYBACK_FILE_PATH,
        this.bytesToBase64(wavBytes),
        { encoding: FileSystem.EncodingType.Base64 },
      );

      return ENROLLMENT_PLAYBACK_FILE_PATH;
    } catch (error) {
      console.error('[VoiceEnrollment] Failed to prepare playback file:', error);
      return null;
    }
  }

  getRecordingDurationMs(): number {
    return ENROLLMENT_DURATION_MS;
  }

  createProfile(params: {
    embedding: number[];
    embeddingsByDurationMs: Record<string, number[]>;
    durationMs: number;
    thresholdSelfHigh?: number;
    thresholdSelfLow?: number;
  }): VoiceEnrollmentProfile {
    return {
      version: ENROLLMENT_PROFILE_VERSION,
      createdAt: Date.now(),
      sampleRate: SAMPLE_RATE,
      durationMs: params.durationMs,
      embedding: params.embedding,
      embeddingsByDurationMs: params.embeddingsByDurationMs,
      model: VOICEPRINT_MODEL,
      thresholdSelfHigh:
        params.thresholdSelfHigh ?? DEFAULT_TITANET_SELF_HIGH_THRESHOLD,
      thresholdSelfLow:
        params.thresholdSelfLow ?? DEFAULT_TITANET_SELF_LOW_THRESHOLD,
    };
  }

  getPcmFormat() {
    return {
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      bitsPerSample: BITS_PER_SAMPLE,
      bytesPerSecond: SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8),
    };
  }
}

export const voiceEnrollmentService = new VoiceEnrollmentService();
