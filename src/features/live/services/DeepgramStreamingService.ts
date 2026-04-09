import { useConversationStore } from '@/features/live/store/conversationStore';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

type Speaker = 'self' | 'other';

type DeepgramWord = {
  speaker: number;
  word: string;
};

type DeepgramMessage = {
  type: string;
  channel?: {
    alternatives: Array<{
      transcript: string;
      words?: DeepgramWord[];
    }>;
  };
  is_final?: boolean;
};

export class DeepgramStreamingService {
  private ws: WebSocket | null = null;
  private onUtteranceEnd: ((speaker: Speaker, text: string) => void) | null =
    null;
  private lastFinalSpeaker: Speaker = 'other';
  private lastFinalText: string = '';

  connect(
    token: string,
    onUtteranceEnd: (speaker: Speaker, text: string) => void,
  ): void {
    this.onUtteranceEnd = onUtteranceEnd;

    const url =
      'wss://api.deepgram.com/v1/listen?' +
      'model=nova-2&language=en&smart_format=true&interim_results=true' +
      '&utterance_end_ms=1500&vad_events=true&punctuate=true&diarize=true' +
      '&encoding=linear16&sample_rate=16000&channels=1';

    this.ws = new WebSocket(url, ['token', token]);

    this.ws.onmessage = (event: MessageEvent) => {
      const data: DeepgramMessage = JSON.parse(event.data);
      const store = useConversationStore.getState();

      if (data.type === 'Results') {
        const transcript = data.channel?.alternatives[0]?.transcript ?? '';
        const isFinal = data.is_final ?? false;
        const words = data.channel?.alternatives[0]?.words ?? [];
        const speaker = this.determineSpeaker(words);

        if (isFinal && transcript.trim().length > 0) {
          this.lastFinalSpeaker = speaker;
          this.lastFinalText = transcript.trim();

          store.addTurn({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            turnId: `${Date.now()}`,
            speaker,
            text: transcript.trim(),
            isFinal: true,
            timestamp: Date.now(),
          });
        } else if (!isFinal) {
          store.updateInterim(transcript, speaker);
        }
      }

      if (data.type === 'UtteranceEnd') {
        this.onUtteranceEnd?.(this.lastFinalSpeaker, this.lastFinalText);
        store.clearInterim();
      }
    };

    this.ws.onerror = (_event: Event) => {};

    this.ws.onclose = (_event: CloseEvent) => {
      this.ws = null;
    };
  }

  sendAudio(base64Data: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const buffer = base64ToArrayBuffer(base64Data);
      this.ws.send(buffer);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.send(new Uint8Array(0));
      this.ws.close();
      this.ws = null;
    }
  }

  private determineSpeaker(words: DeepgramWord[]): Speaker {
    const selfSpeakerId = useConversationStore.getState().selfSpeakerId;

    if (selfSpeakerId === null) {
      return 'other';
    }

    if (words.length === 0) {
      return 'other';
    }

    const hasSpeakerField = words.some(
      (w) => w.speaker !== undefined && w.speaker !== null,
    );
    if (!hasSpeakerField) {
      return 'other';
    }

    const speakerCounts = new Map<number, number>();
    for (const w of words) {
      if (w.speaker !== undefined && w.speaker !== null) {
        speakerCounts.set(w.speaker, (speakerCounts.get(w.speaker) ?? 0) + 1);
      }
    }

    let majoritySpeaker = -1;
    let maxCount = 0;
    for (const [speaker, count] of speakerCounts) {
      if (count > maxCount) {
        maxCount = count;
        majoritySpeaker = speaker;
      }
    }

    return majoritySpeaker === selfSpeakerId ? 'self' : 'other';
  }
}

export const deepgramService = new DeepgramStreamingService();
