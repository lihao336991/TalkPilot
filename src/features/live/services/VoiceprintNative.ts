import { NativeModules, Platform } from 'react-native';

type NativeCompareResult = {
  similarity: number;
  embedding?: number[];
  inputDurationMs?: number;
  melFrameCount?: number;
  modelName?: string;
};

type VoiceprintModuleShape = {
  isAvailable: () => Promise<boolean>;
  generateEmbedding: (base64Pcm: string) => Promise<number[]>;
  compareEmbedding: (
    base64Pcm: string,
    enrollmentEmbedding: number[],
  ) => Promise<NativeCompareResult>;
};

const nativeVoiceprintModule = NativeModules.VoiceprintModule as
  | VoiceprintModuleShape
  | undefined;

class VoiceprintNative {
  private warnedUnavailable = false;

  private get isNativeIOSAvailable() {
    return Platform.OS === 'ios' && Boolean(nativeVoiceprintModule);
  }

  private warnUnavailable() {
    if (this.warnedUnavailable || Platform.OS !== 'ios') {
      return;
    }

    this.warnedUnavailable = true;
    console.warn(
      '[VoiceprintNative] Native VoiceprintModule unavailable. Rebuild iOS after syncing native files.',
    );
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isNativeIOSAvailable) {
      this.warnUnavailable();
      return false;
    }

    try {
      return (await nativeVoiceprintModule?.isAvailable()) ?? false;
    } catch (error) {
      console.warn('[VoiceprintNative] Failed to query availability:', error);
      return false;
    }
  }

  async generateEmbedding(base64Pcm: string): Promise<number[]> {
    if (!this.isNativeIOSAvailable) {
      this.warnUnavailable();
      throw new Error('Native voiceprint module unavailable');
    }

    const embedding = await nativeVoiceprintModule!.generateEmbedding(base64Pcm);
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Native voiceprint embedding is empty');
    }
    return embedding;
  }

  async compareEmbedding(
    base64Pcm: string,
    enrollmentEmbedding: number[],
  ): Promise<NativeCompareResult> {
    if (!this.isNativeIOSAvailable) {
      this.warnUnavailable();
      throw new Error('Native voiceprint module unavailable');
    }

    const result = await nativeVoiceprintModule!.compareEmbedding(
      base64Pcm,
      enrollmentEmbedding,
    );
    if (!result || typeof result.similarity !== 'number') {
      throw new Error('Native voiceprint similarity is invalid');
    }
    return result;
  }
}

export const voiceprintNative = new VoiceprintNative();
