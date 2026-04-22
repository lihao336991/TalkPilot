import { sessionManager } from '@/features/live/services/SessionManager';
import { StreamingWebSocketClient } from '@/features/live/services/StreamingWebSocketClient';
import { useConversationStore } from '@/features/live/store/conversationStore';
import { useDebugStore } from '@/features/live/store/debugStore';
import { useSessionStore } from '@/features/live/store/sessionStore';
import { useSuggestionStore } from '@/features/live/store/suggestionStore';
import { getDeepgramLanguageForTag } from '@/shared/locale/deviceLanguage';

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
  start?: number;
  end?: number;
  punctuated_word?: string;
};

type DeepgramMessage = {
  type: string;
  start?: number;
  duration?: number;
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
  private static readonly PRIME_DRAIN_MS = 250;
  private static readonly PRIME_SILENCE_MS = 300;
  private static readonly AUDIO_BYTES_PER_SECOND = 16_000 * 2;
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
  private currentLanguageTag = 'en';
  private currentDeepgramLanguage = 'en';
  private isPrimingEnrollment = false;
  private suppressMessagesUntil = 0;
  private primeDrainTimer: ReturnType<typeof setTimeout> | null = null;
  private acceptLiveTranscripts = false;
  private audioCursorSeconds = 0;
  private liveTranscriptBoundarySeconds = 0;

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

  private shouldSuppressTranscripts(): boolean {
    return this.isPrimingEnrollment || Date.now() < this.suppressMessagesUntil;
  }

  enableLiveTranscripts(): void {
    this.resetBufferedTurn();
    this.acceptLiveTranscripts = true;
  }

  disableLiveTranscripts(): void {
    this.acceptLiveTranscripts = false;
  }

  markLiveTranscriptBoundary(): void {
    this.liveTranscriptBoundarySeconds = this.audioCursorSeconds;
  }

  private advanceAudioCursor(byteLength: number): void {
    this.audioCursorSeconds +=
      byteLength / DeepgramStreamingService.AUDIO_BYTES_PER_SECOND;
  }

  private buildTranscriptFromWords(words: DeepgramWord[]): string {
    return words
      .map((word) => word.punctuated_word ?? word.word)
      .join(' ')
      .replace(/\s+([.,!?;:])/g, '$1')
      .trim();
  }

  private filterWordsForLiveBoundary(words: DeepgramWord[]): DeepgramWord[] {
    return words.filter((word) => {
      const wordEnd = word.end ?? word.start;
      if (wordEnd == null) {
        return false;
      }
      return wordEnd > this.liveTranscriptBoundarySeconds;
    });
  }

  private filterTranscriptForLiveBoundary(
    transcript: string,
    words: DeepgramWord[],
    segmentStart?: number,
    segmentDuration?: number,
  ): { transcript: string; words: DeepgramWord[] } | null {
    if (this.liveTranscriptBoundarySeconds <= 0) {
      return { transcript: transcript.trim(), words };
    }

    if (words.length > 0) {
      const filteredWords = this.filterWordsForLiveBoundary(words);
      if (filteredWords.length === 0) {
        return null;
      }
      return {
        transcript: this.buildTranscriptFromWords(filteredWords),
        words: filteredWords,
      };
    }

    if (
      segmentStart != null &&
      segmentDuration != null &&
      segmentStart + segmentDuration <= this.liveTranscriptBoundarySeconds
    ) {
      return null;
    }

    return null;
  }

  private clearPrimeDrainTimer(): void {
    if (this.primeDrainTimer) {
      clearTimeout(this.primeDrainTimer);
      this.primeDrainTimer = null;
    }
  }

  private finishPrimingSession(): void {
    this.clearPrimeDrainTimer();
    this.isPrimingEnrollment = false;
    this.suppressMessagesUntil = Date.now() + DeepgramStreamingService.PRIME_DRAIN_MS;
    this.onPrimeUtteranceEnd = null;
    this.resetBufferedTurn();
  }

  private schedulePrimeDrain(onDrained: () => void): void {
    if (!this.isPrimingEnrollment) {
      return;
    }

    this.clearPrimeDrainTimer();
    this.primeDrainTimer = setTimeout(() => {
      this.finishPrimingSession();
      setTimeout(() => {
        if (Date.now() >= this.suppressMessagesUntil) {
          this.suppressMessagesUntil = 0;
        }
        onDrained();
      }, DeepgramStreamingService.PRIME_DRAIN_MS);
    }, DeepgramStreamingService.PRIME_DRAIN_MS);
  }

  connect(
    token: string,
    onUtteranceEnd: (payload: FinalTurnPayload) => Promise<void> | void,
    learningLanguageTag: string,
  ): Promise<void> {
    console.log('[Deepgram] Connecting WebSocket...');
    this.disconnect();
    this.onUtteranceEnd = onUtteranceEnd;
    this.currentLanguageTag = learningLanguageTag;
    this.currentDeepgramLanguage = getDeepgramLanguageForTag(learningLanguageTag);
    this.acceptLiveTranscripts = false;
    this.audioCursorSeconds = 0;
    this.liveTranscriptBoundarySeconds = 0;

    const url =
      'wss://api.deepgram.com/v1/listen?' +
      `model=nova-2&language=${this.currentDeepgramLanguage}&smart_format=true&interim_results=true` +
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
          const detectedLanguage =
            alt?.languages?.[0] ?? this.currentDeepgramLanguage;

          if (this.shouldSuppressTranscripts()) {
            if (this.isPrimingEnrollment) {
              this.determineSpeaker(words);
              if (this.onPrimeUtteranceEnd) {
                this.schedulePrimeDrain(this.onPrimeUtteranceEnd);
              }
            }
            return;
          }

          if (!this.acceptLiveTranscripts) {
            return;
          }

          const liveTranscript = this.filterTranscriptForLiveBoundary(
            transcript,
            words,
            data.start,
            data.duration,
          );
          if (!liveTranscript || liveTranscript.transcript.length === 0) {
            return;
          }

          const speaker = this.determineSpeaker(liveTranscript.words);
          const trimmedTranscript = liveTranscript.transcript;

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
            store.updateInterim(trimmedTranscript, speaker);
          }
        }

        if (data.type === 'UtteranceEnd') {
          if (this.shouldSuppressTranscripts()) {
            if (this.isPrimingEnrollment && this.onPrimeUtteranceEnd) {
              this.schedulePrimeDrain(this.onPrimeUtteranceEnd);
            }
            this.resetBufferedTurn();
            return;
          }

          if (!this.acceptLiveTranscripts) {
            this.resetBufferedTurn();
            return;
          }

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
      this.advanceAudioCursor(buffer.byteLength);
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

  canResumeWithoutReconnect(expectedLanguageTag?: string): boolean {
    if (!this.client.canResumeWithoutReconnect()) {
      return false;
    }

    if (!expectedLanguageTag) {
      return true;
    }

    return (
      getDeepgramLanguageForTag(expectedLanguageTag) === this.currentDeepgramLanguage
    );
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
    this.isPrimingEnrollment = false;
    this.clearPrimeDrainTimer();
    this.suppressMessagesUntil = 0;
    this.onPrimeUtteranceEnd = null;
    this.acceptLiveTranscripts = false;
    this.audioCursorSeconds = 0;
    this.liveTranscriptBoundarySeconds = 0;
  }

  /**
   * Sends a pre-recorded enrollment audio sample through the already-open WebSocket
   * so Deepgram assigns a speaker ID to the user's voice before the live mic starts.
   * Resolves once an UtteranceEnd is received (or after a timeout) with the locked speaker ID.
   */
  async primeWithEnrollment(base64Chunks: string[]): Promise<boolean> {
    if (base64Chunks.length === 0) return false;

    console.log('[Deepgram] Priming with enrollment audio...');
    this.resetBufferedTurn();
    this.isPrimingEnrollment = true;
    this.suppressMessagesUntil = 0;

    await new Promise<void>((resolve) => {
      const PRIME_TIMEOUT_MS = 2_000;
      let settled = false;

      const settle = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };

      const timer = setTimeout(() => {
        console.warn('[Deepgram] Enrollment prime timed out, continuing without lock');
        this.finishPrimingSession();
        setTimeout(() => {
          if (Date.now() >= this.suppressMessagesUntil) {
            this.suppressMessagesUntil = 0;
          }
          settle();
        }, DeepgramStreamingService.PRIME_DRAIN_MS);
      }, PRIME_TIMEOUT_MS);

      this.onPrimeUtteranceEnd = () => {
        settle();
      };

      // Send all enrollment chunks
      for (const chunk of base64Chunks) {
        try {
          const buffer = base64ToArrayBuffer(chunk);
          if (this.client.send(buffer)) {
            this.advanceAudioCursor(buffer.byteLength);
          }
        } catch (err) {
          console.error('[Deepgram] Failed to send enrollment chunk:', err);
        }
      }

      const silenceBytes =
        (DeepgramStreamingService.PRIME_SILENCE_MS / 1000) *
        DeepgramStreamingService.AUDIO_BYTES_PER_SECOND;
      const silenceBuffer = new ArrayBuffer(silenceBytes);
      try {
        if (this.client.send(silenceBuffer)) {
          this.advanceAudioCursor(silenceBuffer.byteLength);
        }
      } catch {}

      try {
        this.client.send('{"type":"Finalize"}');
      } catch {}
    });

    const selfSpeakerId = useConversationStore.getState().selfSpeakerId;
    const didLock = selfSpeakerId !== null;
    console.log('[Deepgram] Enrollment prime complete, didLock=', didLock, 'selfSpeakerId=', selfSpeakerId);
    return didLock;
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
