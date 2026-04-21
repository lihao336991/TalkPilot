import { sessionManager } from '@/features/live/services/SessionManager';
import { StreamingWebSocketClient } from '@/features/live/services/StreamingWebSocketClient';
import { useConversationStore } from '@/features/live/store/conversationStore';
import { useDebugStore } from '@/features/live/store/debugStore';
import { useSessionStore } from '@/features/live/store/sessionStore';
import { useSuggestionStore } from '@/features/live/store/suggestionStore';

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
      languages?: string[];
    }>;
  };
  is_final?: boolean;
};

type FinalTurnPayload = {
  speaker: Speaker;
  text: string;
  turnId: string;
  detectedLanguage?: string;
};

const DEFAULT_RECONNECT_MAX_ATTEMPTS = 3;
const MAIN_DEEPGRAM_LANGUAGE = 'en';

function mergeTranscriptSegments(existing: string, incoming: string): string {
  const base = existing.trim();
  const next = incoming.trim();

  if (!base) {
    return next;
  }

  if (!next) {
    return base;
  }

  if (base === next) {
    return base;
  }

  if (next.startsWith(base)) {
    return next;
  }

  if (base.endsWith(next)) {
    return base;
  }

  return `${base} ${next}`.replace(/\s+/g, ' ').trim();
}

export class DeepgramStreamingService {
  private client = new StreamingWebSocketClient((status) => {
    useConversationStore.getState().setMainWsStatus(status);
  });
  private onUtteranceEnd: ((payload: FinalTurnPayload) => Promise<void> | void) | null =
    null;
  private lastFinalSpeaker: Speaker = 'other';
  private lastFinalText: string = '';
  private lastFinalTurnId: string = '';
  private lastFinalLanguage: string | undefined = undefined;
  private currentUtteranceStartedAt: number | null = null;

  private async commitBufferedTurn(
    speaker: Speaker,
    text: string,
    turnId: string,
    detectedLanguage?: string,
  ): Promise<void> {
    if (speaker === 'self') {
      useSuggestionStore.getState().clear();
    }

    const committedAt = Date.now();
    useConversationStore.getState().addTurn({
      id: `${turnId}-${Math.random().toString(36).slice(2, 8)}`,
      turnId,
      speaker,
      text,
      isFinal: true,
      timestamp: committedAt,
      detectedLanguage,
    });

    const sessionId = useSessionStore.getState().sessionId;
    try {
      await sessionManager.recordTurn({
        sessionId: sessionId ?? '',
        turnId,
        speaker,
        text,
      });
    } catch (error) {
      console.error('[SessionManager] Failed to persist turn before downstream actions:', error);
    }

    useDebugStore.getState().markUtteranceEnd(turnId);
    await this.onUtteranceEnd?.({
      speaker,
      text,
      turnId,
      detectedLanguage,
    });
  }

  private resetBufferedTurn(): void {
    useConversationStore.getState().clearInterim();
    this.lastFinalSpeaker = 'other';
    this.lastFinalText = '';
    this.lastFinalTurnId = '';
    this.lastFinalLanguage = undefined;
    this.currentUtteranceStartedAt = null;
  }

  connect(
    token: string,
    onUtteranceEnd: (payload: FinalTurnPayload) => Promise<void> | void,
  ): Promise<void> {
    console.log('[Deepgram] Connecting WebSocket...');
    this.disconnect();
    this.onUtteranceEnd = onUtteranceEnd;

    const url =
      'wss://api.deepgram.com/v1/listen?' +
      `model=nova-2&language=${MAIN_DEEPGRAM_LANGUAGE}&smart_format=true&interim_results=true` +
      '&utterance_end_ms=1000&vad_events=true&punctuate=true&diarize=true' +
      '&encoding=linear16&sample_rate=16000&channels=1';

    return this.client.connect({
      url,
      webSocketOptions: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      reconnect: {
        enabled: true,
        maxAttempts: DEFAULT_RECONNECT_MAX_ATTEMPTS,
        delayMs: 1_500,
        shouldReconnect: (event) =>
          !('code' in event) || ![1000, 1001].includes(event.code),
        onReconnectScheduled: (attempt, delayMs) => {
          console.log(
            '[Deepgram] Scheduling reconnect attempt',
            attempt,
            'in',
            delayMs,
            'ms',
          );
        },
        onReconnectSuccess: (attempt) => {
          console.log('[Deepgram] Reconnected on attempt', attempt);
        },
      },
      keepAlive: {
        payload: '{"type":"KeepAlive"}',
        intervalMs: 8_000,
      },
      connectErrorMessage: 'Deepgram WebSocket failed to connect',
      closeBeforeOpenMessage: (event) =>
        `Deepgram WebSocket closed before ready (${event.code})`,
      onOpen: () => {
        console.log('[Deepgram] WebSocket connected');
      },
      onMessage: async (event: MessageEvent) => {
        const data: DeepgramMessage = JSON.parse(event.data);
        const store = useConversationStore.getState();

        if (data.type === 'Results') {
          const alt = data.channel?.alternatives[0];
          const transcript = alt?.transcript ?? '';
          const isFinal = data.is_final ?? false;
          const words = alt?.words ?? [];
          const detectedLanguage = alt?.languages?.[0] ?? MAIN_DEEPGRAM_LANGUAGE;
          const speaker = this.determineSpeaker(words);
          const trimmedTranscript = transcript.trim();

          if (!isFinal && trimmedTranscript.length > 0 && this.currentUtteranceStartedAt === null) {
            this.currentUtteranceStartedAt = Date.now();
          }

          if (isFinal && trimmedTranscript.length > 0) {
            console.log('[Deepgram] Final transcript (' + speaker + ', lang=' + (detectedLanguage ?? '?') + '):', transcript.substring(0, 80));
            const timestamp = Date.now();
            const turnId = this.lastFinalTurnId || `${timestamp}`;
            const recordingStartedAt = this.currentUtteranceStartedAt ?? timestamp;
            const mergedText = mergeTranscriptSegments(this.lastFinalText, trimmedTranscript);

            this.lastFinalSpeaker = speaker;
            this.lastFinalText = mergedText;
            this.lastFinalTurnId = turnId;
            if (detectedLanguage) {
              this.lastFinalLanguage = detectedLanguage;
            }
            useDebugStore.getState().registerTurnTrace({
              turnId,
              speaker,
              textPreview: mergedText,
              recordingStartedAt,
              asrFinalAt: timestamp,
            });
            // Keep the full accumulated sentence in interim state until Deepgram confirms the utterance end.
            store.updateInterim(mergedText, speaker);
          } else if (!isFinal) {
            store.updateInterim(transcript, speaker);
          }
        }

        if (data.type === 'UtteranceEnd') {
          // If we're in enrollment priming mode, just lock the speaker and resolve
          if (this.onPrimeUtteranceEnd) {
            this.onPrimeUtteranceEnd();
            this.resetBufferedTurn();
            return;
          }

          const interimText = store.currentInterimText.trim();
          const interimSpeaker = store.currentInterimSpeaker ?? this.lastFinalSpeaker;

          if (!this.lastFinalText && interimText) {
            const fallbackTimestamp = Date.now();
            const fallbackTurnId = `${fallbackTimestamp}`;
            const recordingStartedAt =
              this.currentUtteranceStartedAt ?? fallbackTimestamp;
            console.log('[Deepgram] Promoting interim transcript to final:', interimText.substring(0, 80));
            this.lastFinalSpeaker = interimSpeaker;
            this.lastFinalText = interimText;
            this.lastFinalTurnId = fallbackTurnId;
            useDebugStore.getState().registerTurnTrace({
              turnId: fallbackTurnId,
              speaker: interimSpeaker,
              textPreview: interimText,
              recordingStartedAt,
              asrFinalAt: fallbackTimestamp,
            });
          }

          const committedSpeaker = this.lastFinalSpeaker;
          const committedText = this.lastFinalText;
          const committedTurnId = this.lastFinalTurnId;
          const committedLanguage = this.lastFinalLanguage;

          console.log('[Deepgram] UtteranceEnd -> speaker=' + committedSpeaker + ', lang=' + (committedLanguage ?? '?') + ', turnId=' + committedTurnId);

          if (committedText && committedTurnId) {
            await this.commitBufferedTurn(
              committedSpeaker,
              committedText,
              committedTurnId,
              committedLanguage,
            );
          }

          this.resetBufferedTurn();
        }
      },
      onError: (event: Event) => {
        console.error('[Deepgram] WebSocket error:', event);
        const store = useConversationStore.getState();
        store.setListening(false);
      },
      onClose: (event: CloseEvent) => {
        console.log('[Deepgram] WebSocket closed, code:', event.code, 'reason:', event.reason);
        const store = useConversationStore.getState();
        store.setListening(false);
      },
    });
  }

  sendAudio(base64Data: string): void {
    try {
      const buffer = base64ToArrayBuffer(base64Data);
      const didSend = this.client.send(buffer);
      if (!didSend) {
        return;
      }
    } catch (err) {
      console.error('[Deepgram] Failed to send audio chunk:', err);
    }
  }

  beginPausedRetention(idleTimeoutMs?: number): void {
    if (!this.client.canResumeWithoutReconnect()) {
      return;
    }

    this.client.setReconnectMaxAttempts(Infinity);
    if (idleTimeoutMs == null) {
      console.log('[Deepgram] Keeping WebSocket alive during pause without disconnect timeout');
      this.client.beginPausedRetention();
      return;
    }

    console.log('[Deepgram] Keeping WebSocket alive during pause for', idleTimeoutMs, 'ms');
    this.client.beginPausedRetention(idleTimeoutMs, () => {
      console.log('[Deepgram] Pause idle timeout reached, disconnecting WebSocket...');
      this.disconnect();
    });
  }

  cancelPausedRetention(): void {
    this.client.setReconnectMaxAttempts(DEFAULT_RECONNECT_MAX_ATTEMPTS);
    this.client.cancelPausedRetention();
  }

  canResumeWithoutReconnect(): boolean {
    return this.client.canResumeWithoutReconnect();
  }

  disconnect(): void {
    this.client.setReconnectMaxAttempts(DEFAULT_RECONNECT_MAX_ATTEMPTS);
    console.log('[Deepgram] Disconnecting WebSocket...');
    this.client.disconnect({
      beforeClose: (socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(new Uint8Array(0));
          } catch {}
        }
      },
    });

    this.lastFinalSpeaker = 'other';
    this.lastFinalText = '';
    this.lastFinalTurnId = '';
    this.lastFinalLanguage = undefined;
    this.currentUtteranceStartedAt = null;
  }

  /**
   * Sends a pre-recorded enrollment audio sample through the already-open WebSocket
   * so Deepgram assigns a speaker ID to the user's voice before the live mic starts.
   * Resolves once an UtteranceEnd is received (or after a timeout) with the locked speaker ID.
   */
  async primeWithEnrollment(base64Chunks: string[]): Promise<void> {
    if (base64Chunks.length === 0) return;

    console.log('[Deepgram] Priming with enrollment audio...');

    await new Promise<void>((resolve) => {
      const PRIME_TIMEOUT_MS = 6_000;
      let settled = false;

      const settle = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // Unregister the temporary utterance-end override
        this.onPrimeUtteranceEnd = null;
        resolve();
      };

      const timer = setTimeout(() => {
        console.warn('[Deepgram] Enrollment prime timed out, continuing without lock');
        settle();
      }, PRIME_TIMEOUT_MS);

      // Temporarily intercept the next UtteranceEnd to detect the primed speaker
      this.onPrimeUtteranceEnd = settle;

      // Send all enrollment chunks
      for (const chunk of base64Chunks) {
        try {
          const buffer = base64ToArrayBuffer(chunk);
          this.client.send(buffer);
        } catch (err) {
          console.error('[Deepgram] Failed to send enrollment chunk:', err);
        }
      }

      // Signal end of enrollment audio
      try {
        this.client.send('{"type":"Finalize"}');
      } catch {}
    });

    console.log('[Deepgram] Enrollment prime complete, selfSpeakerId=', useConversationStore.getState().selfSpeakerId);
  }

  private onPrimeUtteranceEnd: (() => void) | null = null;

  private getMajoritySpeaker(words: DeepgramWord[]): number {
    const speakerCounts = new Map<number, number>();
    for (const w of words) {
      if (w.speaker !== undefined && w.speaker !== null) {
        speakerCounts.set(w.speaker, (speakerCounts.get(w.speaker) ?? 0) + 1);
      }
    }

    let majority = -1;
    let maxCount = 0;
    for (const [speaker, count] of speakerCounts) {
      if (count > maxCount) {
        maxCount = count;
        majority = speaker;
      }
    }
    return majority;
  }

  private determineSpeaker(words: DeepgramWord[]): Speaker {
    const store = useConversationStore.getState();
    const { selfSpeakerId, forcedSpeaker } = store;

    if (forcedSpeaker) {
      return forcedSpeaker;
    }

    if (words.length === 0) {
      return selfSpeakerId === null ? 'self' : 'other';
    }

    const hasSpeakerField = words.some(
      (w) => w.speaker !== undefined && w.speaker !== null,
    );
    if (!hasSpeakerField) {
      return selfSpeakerId === null ? 'self' : 'other';
    }

    const majority = this.getMajoritySpeaker(words);
    if (majority === -1) {
      return selfSpeakerId === null ? 'self' : 'other';
    }

    if (selfSpeakerId === null) {
      console.log('[Deepgram] Auto-locking selfSpeakerId to', majority);
      store.setSelfSpeakerId(majority);
      return 'self';
    }

    return majority === selfSpeakerId ? 'self' : 'other';
  }
}

export const deepgramService = new DeepgramStreamingService();
