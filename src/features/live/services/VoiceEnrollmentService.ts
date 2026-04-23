import * as FileSystem from 'expo-file-system/legacy';

const ENROLLMENT_FILE_PATH = `${FileSystem.documentDirectory}voice_enrollment.pcm`;
const ENROLLMENT_PLAYBACK_FILE_PATH = `${FileSystem.cacheDirectory}voice_enrollment.wav`;
const ENROLLMENT_PROFILE_FILE_PATH = `${FileSystem.documentDirectory}voice_enrollment_profile.json`;
const ENROLLMENT_DURATION_MS = 5_000;
const SAMPLE_RATE = 16_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const ENROLLMENT_PROFILE_VERSION = 1;
const VOICEPRINT_MODEL = 'titanet-small-f16-coreml-v1';
const DEFAULT_TITANET_SELF_HIGH_THRESHOLD = 0.58;
const DEFAULT_TITANET_SELF_LOW_THRESHOLD = 0.38;

export type EnrollmentStatus = 'idle' | 'recording' | 'done';

export type VoiceEnrollmentProfile = {
  version: number;
  createdAt: number;
  sampleRate: number;
  durationMs: number;
  embedding: number[];
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
    try {
      const pcmInfo = await FileSystem.getInfoAsync(ENROLLMENT_FILE_PATH);
      const hasPcm = pcmInfo.exists && Number((pcmInfo as any).size ?? 0) > 0;
      if (!hasPcm) {
        return 'missing';
      }

      const profile = await this.loadEnrollmentProfile();
      return profile ? 'ready' : 'legacy_pcm_only';
    } catch {
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
    console.log('[VoiceEnrollment] Saved enrollment audio');
  }

  async loadEnrollmentChunks(): Promise<string[]> {
    try {
      const base64 = await this.loadEnrollmentPcmBase64();
      if (!base64) return [];
      // Split into ~64KB chunks to match AudioEngine buffer cadence
      const chunkSize = 87380; // ~64KB in base64 chars
      const chunks: string[] = [];
      for (let i = 0; i < base64.length; i += chunkSize) {
        chunks.push(base64.slice(i, i + chunkSize));
      }
      return chunks;
    } catch {
      return [];
    }
  }

  async loadEnrollmentPcmBase64(): Promise<string | null> {
    try {
      const base64 = await FileSystem.readAsStringAsync(ENROLLMENT_FILE_PATH, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64 || null;
    } catch {
      return null;
    }
  }

  async saveEnrollmentProfile(profile: VoiceEnrollmentProfile): Promise<void> {
    await FileSystem.writeAsStringAsync(
      ENROLLMENT_PROFILE_FILE_PATH,
      JSON.stringify(profile),
      { encoding: FileSystem.EncodingType.UTF8 },
    );
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
      if (
        parsed.version !== ENROLLMENT_PROFILE_VERSION ||
        parsed.model !== VOICEPRINT_MODEL ||
        !Array.isArray(parsed.embedding) ||
        parsed.embedding.length === 0
      ) {
        return null;
      }

      return {
        version: parsed.version,
        createdAt: parsed.createdAt ?? Date.now(),
        sampleRate: parsed.sampleRate ?? SAMPLE_RATE,
        durationMs: parsed.durationMs ?? ENROLLMENT_DURATION_MS,
        embedding: parsed.embedding,
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
    await this.clearEnrollmentProfile();
    console.log('[VoiceEnrollment] Cleared enrollment audio');
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
