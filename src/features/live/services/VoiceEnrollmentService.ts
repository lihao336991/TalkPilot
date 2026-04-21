import * as FileSystem from 'expo-file-system/legacy';

const ENROLLMENT_FILE_PATH = `${FileSystem.documentDirectory}voice_enrollment.pcm`;
const ENROLLMENT_DURATION_MS = 5_000;

export type EnrollmentStatus = 'idle' | 'recording' | 'done';

/**
 * Manages a persisted PCM audio sample used to prime Deepgram speaker diarization.
 * The sample is recorded once and reused across sessions so the user's speaker ID
 * can be locked before the live mic opens.
 */
class VoiceEnrollmentService {
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
    } catch {
      // ignore
    }
    console.log('[VoiceEnrollment] Cleared enrollment audio');
  }

  getRecordingDurationMs(): number {
    return ENROLLMENT_DURATION_MS;
  }
}

export const voiceEnrollmentService = new VoiceEnrollmentService();
