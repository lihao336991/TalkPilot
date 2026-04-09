import LiveAudioStream from 'react-native-live-audio-stream';
import type { Options } from 'react-native-live-audio-stream';
import { Platform } from 'react-native';
import type { EmitterSubscription } from 'react-native';
import { Audio } from 'expo-av';

const AUDIO_CONFIG: Options = {
  sampleRate: 16000,
  channels: 1,
  bitsPerSample: 16,
  audioSource: 6,
  bufferSize: 4096,
};

export class AudioEngine {
  private subscription: EmitterSubscription | null = null;

  init(): void {
    const config: Options = {
      sampleRate: AUDIO_CONFIG.sampleRate,
      channels: AUDIO_CONFIG.channels,
      bitsPerSample: AUDIO_CONFIG.bitsPerSample,
      bufferSize: AUDIO_CONFIG.bufferSize,
    };
    if (Platform.OS === 'android') {
      config.audioSource = AUDIO_CONFIG.audioSource;
    }
    LiveAudioStream.init(config);
  }

  start(onAudioData: (base64: string) => void): void {
    this.subscription = LiveAudioStream.on('data', onAudioData);
    LiveAudioStream.start();
  }

  stop(): void {
    LiveAudioStream.stop();
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }

  static async requestPermission(): Promise<boolean> {
    const { granted } = await Audio.requestPermissionsAsync();
    return granted;
  }
}

export const audioEngine = new AudioEngine();
