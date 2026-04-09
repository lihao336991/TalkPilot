import type { EmitterSubscription } from 'react-native';

export interface Options {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  audioSource?: number;
  bufferSize?: number;
}

export interface IAudioRecord {
  init: (options: Options) => void;
  start: () => void;
  stop: () => void;
  on: (event: 'data', callback: (data: string) => void) => EmitterSubscription;
}

declare const AudioRecord: IAudioRecord;
export default AudioRecord;
