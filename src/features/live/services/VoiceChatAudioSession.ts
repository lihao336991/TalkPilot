import { NativeModules, Platform } from 'react-native';

type VoiceChatModuleShape = {
  enableVoiceChat: () => Promise<void>;
  disableVoiceChat: () => Promise<void>;
};

const nativeVoiceChatModule = NativeModules.VoiceChatModule as
  | VoiceChatModuleShape
  | undefined;

class VoiceChatAudioSession {
  private warnedUnavailable = false;

  private get isAvailable() {
    return Platform.OS === 'ios' && Boolean(nativeVoiceChatModule);
  }

  private warnUnavailable() {
    if (this.warnedUnavailable || Platform.OS !== 'ios') {
      return;
    }

    this.warnedUnavailable = true;
    console.warn(
      '[VoiceChatAudioSession] Native VoiceChatModule unavailable. Run `npx expo prebuild` and rebuild iOS.',
    );
  }

  async enable(): Promise<void> {
    if (!this.isAvailable) {
      this.warnUnavailable();
      return;
    }

    try {
      await nativeVoiceChatModule?.enableVoiceChat();
    } catch (error) {
      console.warn('[VoiceChatAudioSession] Failed to enable voiceChat mode:', error);
    }
  }

  async disable(): Promise<void> {
    if (!this.isAvailable) {
      return;
    }

    try {
      await nativeVoiceChatModule?.disableVoiceChat();
    } catch (error) {
      console.warn('[VoiceChatAudioSession] Failed to disable voiceChat mode:', error);
    }
  }
}

export const voiceChatAudioSession = new VoiceChatAudioSession();
