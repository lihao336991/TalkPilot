import LiveAudioStream from 'react-native-live-audio-stream';
import type { Options } from 'react-native-live-audio-stream';
import { Platform } from 'react-native';
import type { EmitterSubscription } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { voiceChatAudioSession } from './VoiceChatAudioSession';

const AUDIO_CONFIG: Options = {
  sampleRate: 16000,
  channels: 1,
  bitsPerSample: 16,
  audioSource: 6,
  bufferSize: 4096,
};

export class AudioEngine {
  private subscription: EmitterSubscription | null = null;
  private isInitialized = false;

  private async configureRecordingAudioMode(): Promise<void> {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
    await voiceChatAudioSession.enable();
  }

  private async restoreDefaultAudioMode(): Promise<void> {
    await voiceChatAudioSession.disable();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }

  async init(): Promise<void> {
    console.log('[AudioEngine] Initializing...');
    await this.configureRecordingAudioMode();
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
    this.isInitialized = true;
    console.log('[AudioEngine] Initialized');
  }

  async start(onAudioData: (base64: string) => void): Promise<void> {
    console.log('[AudioEngine] Starting recording...');
    if (!this.isInitialized) {
      await this.init();
    } else {
      await this.configureRecordingAudioMode();
    }

    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.subscription = LiveAudioStream.on('data', onAudioData);
    LiveAudioStream.start();
    console.log('[AudioEngine] Started recording');
  }

  async stop(): Promise<void> {
    console.log('[AudioEngine] Stopping recording...');
    await LiveAudioStream.stop();
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    await this.restoreDefaultAudioMode();
    console.log('[AudioEngine] Stopped recording');
  }

  static async requestPermission(): Promise<boolean> {
    const { granted } = await Audio.requestPermissionsAsync();
    return granted;
  }
}

export const audioEngine = new AudioEngine();
