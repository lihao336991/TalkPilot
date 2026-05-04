import { sessionManager } from '@/features/live/services/SessionManager';
import { StreamingWebSocketClient } from '@/features/live/services/StreamingWebSocketClient';
import {
  VOICEPRINT_STRONG_SELF_THRESHOLD,
  voiceprintService,
} from '@/features/live/services/VoiceprintService';
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
  confidence?: number;
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
      confidence?: number;
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
  isTurnEnd: boolean;
  detectedLanguage?: string;
  confidence?: number;
};

type SpeakerResolution = {
  speaker: Speaker;
  rawId: number;
  source: 'deepgram' | 'voiceprint' | 'hybrid' | 'forced';
  voiceprintSimilarity: number | null;
  voiceprintDecision: 'self' | 'other' | 'unknown' | null;
};

type BufferedTurn = {
  speaker: Speaker;
  rawId: number;
  text: string;
  turnId: string;
  detectedLanguage?: string;
  confidenceSum: number;
  confidenceCount: number;
  recordingStartedAt: number;
  asrFinalAt: number;
  voiceprintSimilarity: number | null;
  voiceprintPeakSimilarity: number | null;
  voiceprintDecision: 'self' | 'other' | 'unknown' | null;
  voiceprintSelfVotes: number;
  voiceprintOtherVotes: number;
  voiceprintUnknownVotes: number;
  speakerDecisionSource: SpeakerResolution['source'];
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
  private onFinalTranscriptUpdated:
    ((payload: FinalTurnPayload) => Promise<void> | void) | null = null;
  private bufferedTurns: BufferedTurn[] = [];
  private currentUtteranceBaseTurnId = '';
  private nextBufferedTurnIndex = 0;
  private currentUtteranceStartedAt: number | null = null;
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
    isTurnEnd: boolean,
    detectedLanguage?: string,
    confidence?: number,
  ): Promise<void> {
    if (speaker === 'self') {
      useSuggestionStore.getState().clear();
    }

    void voiceprintService.reinforceEnrollment({
      speaker,
      forcedSpeaker: useConversationStore.getState().forcedSpeaker,
    });

    const committedAt = Date.now();
    useConversationStore.getState().addTurn({
      id: `${turnId}-${Math.random().toString(36).slice(2, 8)}`,
      turnId,
      speaker,
      text,
      isFinal: true,
      confidence,
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
        confidence,
      });
    } catch (error) {
      console.error('[SessionManager] Failed to persist turn before downstream actions:', error);
    }

    useDebugStore.getState().markUtteranceEnd(turnId);
    await this.onUtteranceEnd?.({
      speaker,
      text,
      turnId,
      isTurnEnd,
      detectedLanguage,
      confidence,
    });
  }

  private resetBufferedTurn(): void {
    const store = useConversationStore.getState();
    store.clearInterim();
    store.clearStablePreview();
    this.bufferedTurns = [];
    this.currentUtteranceBaseTurnId = '';
    this.nextBufferedTurnIndex = 0;
    this.currentUtteranceStartedAt = null;
  }

  private getBufferedFallbackSpeaker(): Speaker {
    return this.bufferedTurns[this.bufferedTurns.length - 1]?.speaker ?? 'other';
  }

  private ensureUtteranceBaseTurnId(seedTimestamp: number): string {
    if (!this.currentUtteranceBaseTurnId) {
      this.currentUtteranceBaseTurnId = `${seedTimestamp}`;
    }
    return this.currentUtteranceBaseTurnId;
  }

  private createBufferedTurn(
    resolution: SpeakerResolution,
    text: string,
    detectedLanguage: string | undefined,
    confidence: number | undefined,
    recordingStartedAt: number,
    seedTimestamp: number,
  ): BufferedTurn {
    const baseTurnId = this.ensureUtteranceBaseTurnId(seedTimestamp);
    const turnId = `${baseTurnId}-${this.nextBufferedTurnIndex++}`;
    return {
      speaker: resolution.speaker,
      rawId: resolution.rawId,
      text,
      turnId,
      detectedLanguage,
      confidenceSum: confidence ?? 0,
      confidenceCount: confidence != null ? 1 : 0,
      recordingStartedAt,
      asrFinalAt: seedTimestamp,
      voiceprintSimilarity: resolution.voiceprintSimilarity,
      voiceprintPeakSimilarity: resolution.voiceprintSimilarity,
      voiceprintDecision: resolution.voiceprintDecision,
      voiceprintSelfVotes: resolution.voiceprintDecision === 'self' ? 1 : 0,
      voiceprintOtherVotes: resolution.voiceprintDecision === 'other' ? 1 : 0,
      voiceprintUnknownVotes: resolution.voiceprintDecision === 'unknown' ? 1 : 0,
      speakerDecisionSource: resolution.source,
    };
  }

  private registerBufferedTurnTrace(turn: BufferedTurn, asrFinalAt: number): void {
    useDebugStore.getState().registerTurnTrace({
      turnId: turn.turnId,
      speaker: turn.speaker,
      deepgramSpeakerId: turn.rawId === -1 ? null : turn.rawId,
      textPreview: turn.text,
      recordingStartedAt: turn.recordingStartedAt,
      asrFinalAt,
      voiceprintSimilarity: turn.voiceprintSimilarity,
      voiceprintDecision: turn.voiceprintDecision,
      speakerDecisionSource: turn.speakerDecisionSource,
    });
  }

  private mergeBufferedTurn(
    turn: BufferedTurn,
    text: string,
    detectedLanguage: string | undefined,
    confidence: number | undefined,
    resolution: SpeakerResolution,
  ): BufferedTurn {
    turn.text = mergeTranscriptSegments(turn.text, text);
    if (detectedLanguage) {
      turn.detectedLanguage = detectedLanguage;
    }
    if (confidence != null) {
      turn.confidenceSum += confidence;
      turn.confidenceCount += 1;
    }
    turn.asrFinalAt = Date.now();
    turn.voiceprintSimilarity = resolution.voiceprintSimilarity;
    turn.voiceprintPeakSimilarity =
      turn.voiceprintPeakSimilarity == null
        ? resolution.voiceprintSimilarity
        : resolution.voiceprintSimilarity == null
          ? turn.voiceprintPeakSimilarity
          : Math.max(turn.voiceprintPeakSimilarity, resolution.voiceprintSimilarity);
    turn.voiceprintDecision = resolution.voiceprintDecision;
    if (resolution.voiceprintDecision === 'self') {
      turn.voiceprintSelfVotes += 1;
    } else if (resolution.voiceprintDecision === 'other') {
      turn.voiceprintOtherVotes += 1;
    } else if (resolution.voiceprintDecision === 'unknown') {
      turn.voiceprintUnknownVotes += 1;
    }
    turn.speakerDecisionSource = resolution.source;
    return turn;
  }

  private applyVoiceprintTurnLevelOverride(turn: BufferedTurn): BufferedTurn {
    if (turn.speakerDecisionSource === 'forced') {
      return turn;
    }

    if (turn.speaker !== 'other') {
      return turn;
    }

    const strongSelfHit =
      turn.voiceprintPeakSimilarity != null &&
      turn.voiceprintPeakSimilarity >= VOICEPRINT_STRONG_SELF_THRESHOLD;
    const selfMajority =
      turn.voiceprintSelfVotes >= 2 &&
      turn.voiceprintSelfVotes > turn.voiceprintOtherVotes;

    // Be more aggressive at the whole-bubble level. If a turn has a strong
    // self-like hit, or its accumulated voiceprint votes lean to self, allow
    // the whole bubble to flip back to "self" even when Deepgram said "other".
    if (
      (selfMajority || (strongSelfHit && turn.voiceprintSelfVotes >= turn.voiceprintOtherVotes)) &&
      turn.voiceprintOtherVotes === 0
    ) {
      turn.speaker = 'self';
      turn.voiceprintDecision = 'self';
      turn.voiceprintSimilarity = turn.voiceprintPeakSimilarity ?? turn.voiceprintSimilarity;
      turn.speakerDecisionSource = 'voiceprint';
    }

    return turn;
  }

  private resolvePreviewSpeakerFromResolution(
    resolution: SpeakerResolution,
  ): Speaker {
    if (resolution.source === 'forced') {
      return resolution.speaker;
    }

    // For live preview bubbles, bias toward local voiceprint as soon as the
    // current audio already looks like the user. This avoids a left-side draft
    // bubble flashing back to the right only at final commit time.
    if (resolution.voiceprintDecision === 'self') {
      return 'self';
    }

    return resolution.speaker;
  }

  private resolvePreviewSpeakerForBufferedTurn(turn: BufferedTurn): Speaker {
    if (turn.speakerDecisionSource === 'forced') {
      return turn.speaker;
    }

    if (turn.speaker === 'self') {
      return 'self';
    }

    const hasSelfLean =
      turn.voiceprintSelfVotes > turn.voiceprintOtherVotes &&
      turn.voiceprintSelfVotes > 0;
    const hasStrongSelfHit =
      turn.voiceprintPeakSimilarity != null &&
      turn.voiceprintPeakSimilarity >= VOICEPRINT_STRONG_SELF_THRESHOLD &&
      turn.voiceprintOtherVotes === 0;

    if (hasSelfLean || hasStrongSelfHit) {
      return 'self';
    }

    return turn.speaker;
  }

  private releaseBufferedTurnsExceptLast(): BufferedTurn[] {
    if (this.bufferedTurns.length <= 1) {
      return [];
    }

    const committedTurns = this.bufferedTurns.slice(0, -1);
    this.bufferedTurns = this.bufferedTurns.slice(-1);
    return committedTurns;
  }

  private drainBufferedTurns(): BufferedTurn[] {
    const committedTurns = this.bufferedTurns;
    this.bufferedTurns = [];
    return committedTurns;
  }

  private splitWordRuns(words: DeepgramWord[]): DeepgramWord[][] {
    if (words.length === 0) {
      return [];
    }

    const runs: DeepgramWord[][] = [];
    let currentRun: DeepgramWord[] = [];
    let currentSpeaker: number | null | undefined = undefined;

    for (const word of words) {
      const nextSpeaker = word.speaker ?? null;
      if (currentRun.length === 0) {
        currentRun = [word];
        currentSpeaker = nextSpeaker;
        continue;
      }

      if (nextSpeaker === currentSpeaker) {
        currentRun.push(word);
        continue;
      }

      runs.push(currentRun);
      currentRun = [word];
      currentSpeaker = nextSpeaker;
    }

    if (currentRun.length > 0) {
      runs.push(currentRun);
    }

    return runs;
  }

  private async commitBufferedTurns(
    turns: BufferedTurn[],
    isTurnEnd: boolean,
  ): Promise<void> {
    for (const turn of turns) {
      this.applyVoiceprintTurnLevelOverride(turn);
      this.registerBufferedTurnTrace(turn, turn.asrFinalAt);
      const confidence =
        turn.confidenceCount > 0 ? turn.confidenceSum / turn.confidenceCount : undefined;
      await this.commitBufferedTurn(
        turn.speaker,
        turn.text,
        turn.turnId,
        isTurnEnd,
        turn.detectedLanguage,
        confidence,
      );
    }
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
    onFinalTranscriptUpdated?: (payload: FinalTurnPayload) => Promise<void> | void,
  ): Promise<void> {
    console.log('[Deepgram] Connecting WebSocket...');
    this.disconnect();
    this.onUtteranceEnd = onUtteranceEnd;
    this.onFinalTranscriptUpdated = onFinalTranscriptUpdated ?? null;
    this.currentDeepgramLanguage = getDeepgramLanguageForTag(learningLanguageTag);
    this.acceptLiveTranscripts = false;
    this.audioCursorSeconds = 0;
    this.liveTranscriptBoundarySeconds = 0;

    const url =
      'wss://api.deepgram.com/v1/listen?' +
      `model=nova-3&language=${this.currentDeepgramLanguage}&smart_format=true&interim_results=true` +
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

          const trimmedTranscript = liveTranscript.transcript;

          if (!isFinal && trimmedTranscript.length > 0 && this.currentUtteranceStartedAt === null) {
            this.currentUtteranceStartedAt = Date.now();
          }

          if (isFinal && trimmedTranscript.length > 0) {
            const segmentConfidence = alt?.confidence;
            const timestamp = Date.now();
            const recordingStartedAt = this.currentUtteranceStartedAt ?? timestamp;
            const wordRuns =
              liveTranscript.words.length > 0
                ? this.splitWordRuns(liveTranscript.words)
                : [liveTranscript.words];
            const committedTurns: BufferedTurn[] = [];
            let latestBufferedTurn: BufferedTurn | null = null;

            for (const runWords of wordRuns) {
              const runText =
                runWords.length > 0
                  ? this.buildTranscriptFromWords(runWords)
                  : trimmedTranscript;
              const nextText = runText.trim();
              if (!nextText) {
                continue;
              }

              const resolution = this.determineSpeaker(runWords);
              console.log(
                '[Deepgram] Final transcript (' +
                  resolution.speaker +
                  ', source=' +
                  resolution.source +
                  ', rawId=' +
                  resolution.rawId +
                  ', vp=' +
                  (resolution.voiceprintSimilarity?.toFixed(3) ?? '?') +
                  ', vpDecision=' +
                  (resolution.voiceprintDecision ?? '?') +
                  ', lang=' +
                  (detectedLanguage ?? '?') +
                  ', conf=' +
                  (segmentConfidence?.toFixed(3) ?? '?') +
                  '):',
                nextText.substring(0, 80),
              );

              const lastBufferedTurn =
                this.bufferedTurns[this.bufferedTurns.length - 1] ?? null;
              const shouldMerge =
                lastBufferedTurn != null &&
                lastBufferedTurn.speaker === resolution.speaker &&
                (resolution.rawId === -1 ||
                  lastBufferedTurn.rawId === -1 ||
                  lastBufferedTurn.rawId === resolution.rawId);

              if (shouldMerge && lastBufferedTurn) {
                latestBufferedTurn = this.mergeBufferedTurn(
                  lastBufferedTurn,
                  nextText,
                  detectedLanguage,
                  segmentConfidence,
                  resolution,
                );
              } else {
                latestBufferedTurn = this.createBufferedTurn(
                  resolution,
                  nextText,
                  detectedLanguage,
                  segmentConfidence,
                  recordingStartedAt,
                  timestamp,
                );
                this.bufferedTurns.push(latestBufferedTurn);
                committedTurns.push(...this.releaseBufferedTurnsExceptLast());
              }

              this.registerBufferedTurnTrace(latestBufferedTurn, timestamp);
              const latestConfidence =
                latestBufferedTurn.confidenceCount > 0
                  ? latestBufferedTurn.confidenceSum / latestBufferedTurn.confidenceCount
                  : segmentConfidence;
              void this.onFinalTranscriptUpdated?.({
                speaker: latestBufferedTurn.speaker,
                text: latestBufferedTurn.text,
                turnId: latestBufferedTurn.turnId,
                isTurnEnd: false,
                detectedLanguage: latestBufferedTurn.detectedLanguage,
                confidence: latestConfidence,
              });
            }

            if (latestBufferedTurn) {
              // Keep the latest finalized chunk visually stable, and let later
              // interim updates only render the unstable tail as a draft bubble.
              store.updateStablePreview(
                latestBufferedTurn.text,
                this.resolvePreviewSpeakerForBufferedTurn(latestBufferedTurn),
              );
              store.clearInterim();
            }

            if (committedTurns.length > 0) {
              void this.commitBufferedTurns(committedTurns, false);
            }
          } else if (!isFinal) {
            const interimResolution = this.determineSpeaker(liveTranscript.words);
            store.updateInterim(
              trimmedTranscript,
              this.resolvePreviewSpeakerFromResolution(interimResolution),
            );
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
          const interimSpeaker =
            store.currentInterimSpeaker ?? this.getBufferedFallbackSpeaker();

          if (this.bufferedTurns.length === 0 && interimText) {
            const fallbackTimestamp = Date.now();
            const recordingStartedAt =
              this.currentUtteranceStartedAt ?? fallbackTimestamp;
            console.log(
              '[Deepgram] Promoting interim transcript to final:',
              interimText.substring(0, 80),
            );
            const fallbackTurn = this.createBufferedTurn(
              {
                speaker: interimSpeaker,
                rawId: -1,
                source: 'deepgram',
                voiceprintSimilarity: null,
                voiceprintDecision: null,
              },
              interimText,
              this.currentDeepgramLanguage,
              undefined,
              recordingStartedAt,
              fallbackTimestamp,
            );
            this.bufferedTurns.push(fallbackTurn);
            this.registerBufferedTurnTrace(fallbackTurn, fallbackTimestamp);
          }

          const committedTurns = this.drainBufferedTurns();
          if (committedTurns.length > 0) {
            const summary = committedTurns
              .map((turn) => `${turn.speaker}:${turn.turnId}`)
              .join(', ');
            console.log('[Deepgram] UtteranceEnd -> committing turns:', summary);
          }

          this.resetBufferedTurn();

          if (committedTurns.length > 0) {
            await this.commitBufferedTurns(committedTurns, true);
          }
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

    this.resetBufferedTurn();
    this.isPrimingEnrollment = false;
    this.clearPrimeDrainTimer();
    this.suppressMessagesUntil = 0;
    this.onPrimeUtteranceEnd = null;
    this.onFinalTranscriptUpdated = null;
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

  private determineDeepgramSpeaker(
    words: DeepgramWord[],
    selfSpeakerId: number | null,
    allowAutoLock: boolean,
  ): { speaker: Speaker; rawId: number } {
    if (words.length === 0) {
      const result = selfSpeakerId === null ? 'self' : 'other';
      return { speaker: result as Speaker, rawId: -1 };
    }

    const hasSpeakerField = words.some(
      (w) => w.speaker !== undefined && w.speaker !== null,
    );
    if (!hasSpeakerField) {
      const result = selfSpeakerId === null ? 'self' : 'other';
      return { speaker: result as Speaker, rawId: -1 };
    }

    const majority = this.getMajoritySpeaker(words);
    if (majority === -1) {
      const result = selfSpeakerId === null ? 'self' : 'other';
      return { speaker: result as Speaker, rawId: -1 };
    }

    if (selfSpeakerId === null) {
      if (allowAutoLock) {
        console.log('[Deepgram] Auto-locking selfSpeakerId to', majority);
        useConversationStore.getState().setSelfSpeakerId(majority);
        return { speaker: 'self', rawId: majority };
      }

      return { speaker: this.getBufferedFallbackSpeaker(), rawId: majority };
    }

    const result = majority === selfSpeakerId ? 'self' : 'other';
    return { speaker: result as Speaker, rawId: majority };
  }

  private determineSpeaker(words: DeepgramWord[]): SpeakerResolution {
    const store = useConversationStore.getState();
    const { selfSpeakerId, forcedSpeaker, voiceprintEnrollmentReady } = store;
    const voiceprint = voiceprintService.getCurrentDecision();
    const voiceprintSimilarity = voiceprint.similarity;
    const voiceprintDecision = voiceprint.label;

    if (forcedSpeaker) {
      store.setSpeakerDecisionSource('forced');
      return {
        speaker: forcedSpeaker,
        rawId: -1,
        source: 'forced',
        voiceprintSimilarity,
        voiceprintDecision,
      };
    }

    const allowAutoLock =
      (voiceprintDecision !== 'other' && voiceprintEnrollmentReady) ||
      this.isPrimingEnrollment;
    const deepgramResolution = this.determineDeepgramSpeaker(
      words,
      selfSpeakerId,
      allowAutoLock,
    );

    // When Deepgram already provides a concrete speaker id, keep turn partitioning
    // and left/right ownership primarily driven by Deepgram. Voiceprint remains a
    // supporting signal for auto-locking and debug visibility, but should not
    // split one sentence into mixed-side bubbles at word-run granularity.
    if (deepgramResolution.rawId !== -1) {
      const source =
        (voiceprintDecision === 'self' && deepgramResolution.speaker === 'self') ||
        (voiceprintDecision === 'other' && deepgramResolution.speaker === 'other')
          ? 'hybrid'
          : 'deepgram';
      store.setSpeakerDecisionSource(source);
      return {
        speaker: deepgramResolution.speaker,
        rawId: deepgramResolution.rawId,
        source,
        voiceprintSimilarity,
        voiceprintDecision,
      };
    }

    if (voiceprintDecision === 'self') {
      store.setSpeakerDecisionSource('voiceprint');
      return {
        speaker: 'self',
        rawId: deepgramResolution.rawId,
        source: 'voiceprint',
        voiceprintSimilarity,
        voiceprintDecision,
      };
    }

    if (voiceprintDecision === 'other') {
      const speaker =
        this.bufferedTurns.length > 0
          ? this.getBufferedFallbackSpeaker()
          : deepgramResolution.speaker;
      const source = speaker === 'other' ? 'voiceprint' : 'deepgram';
      store.setSpeakerDecisionSource(source);
      return {
        speaker,
        rawId: deepgramResolution.rawId,
        source,
        voiceprintSimilarity,
        voiceprintDecision,
      };
    }

    store.setSpeakerDecisionSource('deepgram');
    return {
      speaker: deepgramResolution.speaker,
      rawId: deepgramResolution.rawId,
      source: 'deepgram',
      voiceprintSimilarity,
      voiceprintDecision,
    };
  }
}

export const deepgramService = new DeepgramStreamingService();
