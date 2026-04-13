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
    }>;
  };
  is_final?: boolean;
};

type FinalTurnPayload = {
  speaker: Speaker;
  text: string;
  turnId: string;
};

const DEFAULT_RECONNECT_MAX_ATTEMPTS = 3;

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
  private currentUtteranceStartedAt: number | null = null;
  private audioChunksSent = 0;
  private firstChunkReported = false;

  private async commitBufferedTurn(
    speaker: Speaker,
    text: string,
    turnId: string,
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
    });
  }

  private resetBufferedTurn(): void {
    useConversationStore.getState().clearInterim();
    this.lastFinalSpeaker = 'other';
    this.lastFinalText = '';
    this.lastFinalTurnId = '';
    this.currentUtteranceStartedAt = null;
  }

  connect(
    token: string,
    onUtteranceEnd: (payload: FinalTurnPayload) => Promise<void> | void,
  ): Promise<void> {
    console.log('[Deepgram] Connecting WebSocket...');
    this.disconnect();
    this.onUtteranceEnd = onUtteranceEnd;
    this.audioChunksSent = 0;
    this.firstChunkReported = false;
    const traceId = `dgws-${Date.now()}`;
    const startedAt = Date.now();

    const url =
      'wss://api.deepgram.com/v1/listen?' +
      'model=nova-2&language=en&smart_format=true&interim_results=true' +
      '&utterance_end_ms=1500&vad_events=true&punctuate=true&diarize=true' +
      '&encoding=linear16&sample_rate=16000&channels=1';
    // #region debug-point B:websocket-connect-attempt
    void fetch('http://10.200.4.178:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'deepgram-ws-401', runId: 'post-fix', hypothesisId: 'B', location: 'DeepgramStreamingService.ts:58', msg: '[DEBUG] opening deepgram websocket with authorization header auth', data: { traceId, tokenLength: token.length, tokenHasDot: token.includes('.'), tokenPrefix: token.slice(0, 12), authMode: 'authorization-header-bearer', url, hasEncodingLinear16: url.includes('encoding=linear16'), hasSampleRate16000: url.includes('sample_rate=16000') }, ts: Date.now(), traceId }) }).catch(() => {});
    // #endregion

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
        // #region debug-point A:websocket-open
        void fetch('http://10.200.4.178:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'deepgram-ws-401', runId: 'post-fix', hypothesisId: 'A', location: 'DeepgramStreamingService.ts:68', msg: '[DEBUG] deepgram websocket opened', data: { traceId, elapsedMs: Date.now() - startedAt }, ts: Date.now(), traceId }) }).catch(() => {});
        // #endregion
        console.log('[Deepgram] WebSocket connected');
      },
      onMessage: async (event: MessageEvent) => {
        const data: DeepgramMessage = JSON.parse(event.data);
        const store = useConversationStore.getState();

        if (data.type === 'Results') {
          const transcript = data.channel?.alternatives[0]?.transcript ?? '';
          const isFinal = data.is_final ?? false;
          const words = data.channel?.alternatives[0]?.words ?? [];
          const speaker = this.determineSpeaker(words);
          const trimmedTranscript = transcript.trim();
          // #region debug-point F:results-packet
          void fetch('http://10.200.4.178:7777/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: 'deepgram-ws-401',
              runId: 'post-fix',
              hypothesisId: 'F',
              location: 'DeepgramStreamingService.ts:88',
              msg: '[DEBUG] deepgram results packet received',
              data: {
                isFinal,
                transcriptLength: transcript.length,
                hasWords: words.length > 0,
                wordCount: words.length,
                speaker,
                transcriptPreview: transcript.slice(0, 40),
              },
              ts: Date.now(),
            }),
          }).catch(() => {});
          // #endregion

          if (!isFinal && trimmedTranscript.length > 0 && this.currentUtteranceStartedAt === null) {
            this.currentUtteranceStartedAt = Date.now();
          }

          if (isFinal && trimmedTranscript.length > 0) {
            console.log('[Deepgram] Final transcript (' + speaker + '):', transcript.substring(0, 80));
            const timestamp = Date.now();
            const turnId = this.lastFinalTurnId || `${timestamp}`;
            const recordingStartedAt = this.currentUtteranceStartedAt ?? timestamp;
            const mergedText = mergeTranscriptSegments(this.lastFinalText, trimmedTranscript);

            this.lastFinalSpeaker = speaker;
            this.lastFinalText = mergedText;
            this.lastFinalTurnId = turnId;
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
          // #region debug-point F:utterance-end
          void fetch('http://10.200.4.178:7777/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: 'deepgram-ws-401',
              runId: 'post-fix',
              hypothesisId: 'F',
              location: 'DeepgramStreamingService.ts:147',
              msg: '[DEBUG] deepgram utterance end received',
              data: {
                hasLastFinalText: this.lastFinalText.length > 0,
                lastFinalTurnId: this.lastFinalTurnId,
                interimLength: store.currentInterimText.length,
                interimSpeaker: store.currentInterimSpeaker,
              },
              ts: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
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

          console.log('[Deepgram] UtteranceEnd -> speaker=' + committedSpeaker + ', turnId=' + committedTurnId);

          if (store.forcedSpeaker === 'other' && !store.releaseForcedOnUtteranceEnd) {
            console.log('[Deepgram] Holding simulated-other turn until explicit release');
            return;
          }

          if (store.releaseForcedOnUtteranceEnd) {
            store.setForcedSpeaker(null);
            store.setReleaseForcedOnUtteranceEnd(false);
            console.log('[Deepgram] Cleared forced speaker after utterance end');
          }

          if (committedText && committedTurnId) {
            await this.commitBufferedTurn(
              committedSpeaker,
              committedText,
              committedTurnId,
            );
          }

          this.resetBufferedTurn();
        }
      },
      onError: (event: Event) => {
        // #region debug-point B:websocket-error
        void fetch('http://10.200.4.178:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'deepgram-ws-401', runId: 'post-fix', hypothesisId: 'B', location: 'DeepgramStreamingService.ts:134', msg: '[DEBUG] deepgram websocket errored before usable stream', data: { traceId, elapsedMs: Date.now() - startedAt, eventType: event.type, readyState: this.client.getReadyState() }, ts: Date.now(), traceId }) }).catch(() => {});
        // #endregion
        console.error('[Deepgram] WebSocket error:', event);
        const store = useConversationStore.getState();
        store.setListening(false);
      },
      onClose: (event: CloseEvent) => {
        // #region debug-point B:websocket-close
        void fetch('http://10.200.4.178:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'deepgram-ws-401', runId: 'post-fix', hypothesisId: 'B', location: 'DeepgramStreamingService.ts:139', msg: '[DEBUG] deepgram websocket closed', data: { traceId, elapsedMs: Date.now() - startedAt, code: event.code, reason: event.reason, wasClean: event.wasClean }, ts: Date.now(), traceId }) }).catch(() => {});
        // #endregion
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
      this.audioChunksSent += 1;
      if (!this.firstChunkReported || this.audioChunksSent % 100 === 0) {
        // #region debug-point E:audio-chunk-sent
        void fetch('http://10.200.4.178:7777/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'deepgram-ws-401',
            runId: 'post-fix',
            hypothesisId: 'E',
            location: 'DeepgramStreamingService.ts:142',
            msg: '[DEBUG] audio chunk sent to websocket',
            data: { audioChunksSent: this.audioChunksSent, bytes: (buffer as ArrayBuffer).byteLength },
            ts: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        this.firstChunkReported = true;
      }
    } catch (err) {
      // #region debug-point E:audio-chunk-error
      void fetch('http://10.200.4.178:7777/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'deepgram-ws-401',
          runId: 'post-fix',
          hypothesisId: 'E',
          location: 'DeepgramStreamingService.ts:156',
          msg: '[DEBUG] audio chunk send failed',
          data: { error: err instanceof Error ? err.message : String(err) },
          ts: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
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
    this.currentUtteranceStartedAt = null;
    this.audioChunksSent = 0;
    this.firstChunkReported = false;
  }

  async flushHeldForcedTurn(): Promise<void> {
    const store = useConversationStore.getState();
    const text = this.lastFinalText || store.currentInterimText.trim();
    const turnId = this.lastFinalTurnId || `${Date.now()}`;

    store.setForcedSpeaker(null);
    store.setReleaseForcedOnUtteranceEnd(false);

    if (!text) {
      this.resetBufferedTurn();
      return;
    }

    await this.commitBufferedTurn('other', text, turnId);
    this.resetBufferedTurn();
  }

  cancelHeldForcedTurn(): void {
    const store = useConversationStore.getState();
    store.setForcedSpeaker(null);
    store.setReleaseForcedOnUtteranceEnd(false);
    this.resetBufferedTurn();
  }

  private determineSpeaker(words: DeepgramWord[]): Speaker {
    const { selfSpeakerId, forcedSpeaker } = useConversationStore.getState();

    if (forcedSpeaker) {
      return forcedSpeaker;
    }

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
