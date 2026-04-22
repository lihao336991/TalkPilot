import * as FileSystem from 'expo-file-system/legacy';

const ENROLLMENT_FILE_PATH = `${FileSystem.documentDirectory}voice_enrollment.pcm`;
const ENROLLMENT_PLAYBACK_FILE_PATH = `${FileSystem.cacheDirectory}voice_enrollment.wav`;
const ENROLLMENT_DURATION_MS = 5_000;
const SAMPLE_RATE = 16_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

export type EnrollmentStatus = 'idle' | 'recording' | 'done';

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
    try {
      const info = await FileSystem.getInfoAsync(ENROLLMENT_FILE_PATH);
      return info.exists && (info as any).size > 0;
    } catch {
      return false;
    }
  }

  async saveEnrollment(base64Chunks: string[]): Promise<void> {
    // Concatenate all base64 chunks into one base64 string then write as binary
    const combined = base64Chunks.join('');
    await FileSystem.writeAsStringAsync(ENROLLMENT_FILE_PATH, combined, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('[VoiceEnrollment] Saved enrollment audio');
  }

  async loadEnrollmentChunks(): Promise<string[]> {
    try {
      const base64 = await FileSystem.readAsStringAsync(ENROLLMENT_FILE_PATH, {
        encoding: FileSystem.EncodingType.Base64,
      });
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
}

export const voiceEnrollmentService = new VoiceEnrollmentService();
