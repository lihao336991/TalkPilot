import { sessionManager } from '@/features/live/services/SessionManager';
import { StreamingWebSocketClient } from '@/features/live/services/StreamingWebSocketClient';
import {
  type VoiceprintRangeAnalysis,
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
  voiceprintSelfTopKSimilarity: number | null;
  voiceprintSelfPeakSimilarity: number | null;
  voiceprintOtherTopKSimilarity: number | null;
  voiceprintOtherPeakSimilarity: number | null;
  voiceprintSelfMemoryCount: number;
  voiceprintOtherMemoryCount: number;
  speakerDecisionReason: string | null;
  voiceprintRangeStartMs: number | null;
  voiceprintRangeEndMs: number | null;
  turnEmbedding: number[] | null;
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
  voiceprintSelfTopKSimilarity: number | null;
  voiceprintSelfPeakSimilarity: number | null;
  voiceprintOtherTopKSimilarity: number | null;
  voiceprintOtherPeakSimilarity: number | null;
  voiceprintSelfMemoryCount: number;
  voiceprintOtherMemoryCount: number;
  speakerDecisionReason: string | null;
  voiceprintSelfVotes: number;
  voiceprintOtherVotes: number;
  voiceprintUnknownVotes: number;
  speakerDecisionSource: SpeakerResolution['source'];
  voiceprintRangeStartMs: number | null;
  voiceprintRangeEndMs: number | null;
  turnEmbedding: number[] | null;
};

type SpeakerMemorySource =
  | 'strong_enrollment'
  | 'weak_seed'
  | 'self_match'
  | 'other_match'
  | 'low_enrollment';

type SpeakerEmbeddingSample = {
  embedding: number[];
  enrollmentSimilarity: number | null;
  createdAt: number;
  confidence: number;
  source: SpeakerMemorySource;
};

type SpeakerMemoryStats = {
  topKAvg: number | null;
  peak: number | null;
  count: number;
};

const DEFAULT_RECONNECT_MAX_ATTEMPTS = 3;
const SPEAKER_MEMORY_LIMIT = 10;
const SPEAKER_MEMORY_TOP_K = 3;
const SELF_MEMORY_MATCH_THRESHOLD = 0.55;
const SELF_MEMORY_PEAK_THRESHOLD = 0.62;
const SELF_MEMORY_SUPPORT_THRESHOLD = 0.50;
const OTHER_MEMORY_MATCH_THRESHOLD = 0.55;
const MEMORY_SIMILARITY_MARGIN = 0.06;
const WEAK_SELF_SEED_MIN_SIMILARITY = 0.36;
const SELF_MIGRATION_MARGIN = 0.04;
const SELF_MIGRATION_DISSIMILARITY_THRESHOLD = 0.50;

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
  private acceptLiveTranscripts = false;
  private audioCursorSeconds = 0;
  private liveTranscriptBoundarySeconds = 0;
  private speakerMemory: Record<Speaker, SpeakerEmbeddingSample[]> = {
    self: [],
    other: [],
  };

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
      voiceprintSelfTopKSimilarity: resolution.voiceprintSelfTopKSimilarity,
      voiceprintSelfPeakSimilarity: resolution.voiceprintSelfPeakSimilarity,
      voiceprintOtherTopKSimilarity: resolution.voiceprintOtherTopKSimilarity,
      voiceprintOtherPeakSimilarity: resolution.voiceprintOtherPeakSimilarity,
      voiceprintSelfMemoryCount: resolution.voiceprintSelfMemoryCount,
      voiceprintOtherMemoryCount: resolution.voiceprintOtherMemoryCount,
      speakerDecisionReason: resolution.speakerDecisionReason,
      voiceprintSelfVotes: resolution.voiceprintDecision === 'self' ? 1 : 0,
      voiceprintOtherVotes: resolution.voiceprintDecision === 'other' ? 1 : 0,
      voiceprintUnknownVotes: resolution.voiceprintDecision === 'unknown' ? 1 : 0,
      speakerDecisionSource: resolution.source,
      voiceprintRangeStartMs: resolution.voiceprintRangeStartMs,
      voiceprintRangeEndMs: resolution.voiceprintRangeEndMs,
      turnEmbedding: resolution.turnEmbedding,
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
      voiceprintSelfTopKSimilarity: turn.voiceprintSelfTopKSimilarity,
      voiceprintSelfPeakSimilarity: turn.voiceprintSelfPeakSimilarity,
      voiceprintOtherTopKSimilarity: turn.voiceprintOtherTopKSimilarity,
      voiceprintOtherPeakSimilarity: turn.voiceprintOtherPeakSimilarity,
      voiceprintSelfMemoryCount: turn.voiceprintSelfMemoryCount,
      voiceprintOtherMemoryCount: turn.voiceprintOtherMemoryCount,
      speakerDecisionReason: turn.speakerDecisionReason,
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
    turn.voiceprintSelfTopKSimilarity = resolution.voiceprintSelfTopKSimilarity;
    turn.voiceprintSelfPeakSimilarity = resolution.voiceprintSelfPeakSimilarity;
    turn.voiceprintOtherTopKSimilarity = resolution.voiceprintOtherTopKSimilarity;
    turn.voiceprintOtherPeakSimilarity = resolution.voiceprintOtherPeakSimilarity;
    turn.voiceprintSelfMemoryCount = resolution.voiceprintSelfMemoryCount;
    turn.voiceprintOtherMemoryCount = resolution.voiceprintOtherMemoryCount;
    turn.speakerDecisionReason = resolution.speakerDecisionReason;
    turn.turnEmbedding = resolution.turnEmbedding ?? turn.turnEmbedding;
    turn.voiceprintRangeStartMs =
      turn.voiceprintRangeStartMs == null
        ? resolution.voiceprintRangeStartMs
        : resolution.voiceprintRangeStartMs == null
          ? turn.voiceprintRangeStartMs
          : Math.min(turn.voiceprintRangeStartMs, resolution.voiceprintRangeStartMs);
    turn.voiceprintRangeEndMs =
      turn.voiceprintRangeEndMs == null
        ? resolution.voiceprintRangeEndMs
        : resolution.voiceprintRangeEndMs == null
          ? turn.voiceprintRangeEndMs
          : Math.max(turn.voiceprintRangeEndMs, resolution.voiceprintRangeEndMs);
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
    return turn;
  }

  private resolvePreviewSpeakerFromResolution(
    resolution: SpeakerResolution,
  ): Speaker {
    return resolution.speaker;
  }

  private resolvePreviewSpeakerForBufferedTurn(turn: BufferedTurn): Speaker {
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
    this.resetSpeakerFusionState();

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

              const resolution = await this.resolveFinalSpeaker(runWords);
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
                lastBufferedTurn.speaker === resolution.speaker;

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
            const interimResolution = this.determineInterimSpeaker(liveTranscript.words);
            store.updateInterim(
              trimmedTranscript,
              this.resolvePreviewSpeakerFromResolution(interimResolution),
            );
          }
        }

        if (data.type === 'UtteranceEnd') {
          if (!this.acceptLiveTranscripts) {
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
                voiceprintSelfTopKSimilarity: null,
                voiceprintSelfPeakSimilarity: null,
                voiceprintOtherTopKSimilarity: null,
                voiceprintOtherPeakSimilarity: null,
                voiceprintSelfMemoryCount: this.speakerMemory.self.length,
                voiceprintOtherMemoryCount: this.speakerMemory.other.length,
                speakerDecisionReason: 'promoted_interim',
                voiceprintRangeStartMs: null,
                voiceprintRangeEndMs: null,
                turnEmbedding: null,
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
    this.onFinalTranscriptUpdated = null;
    this.acceptLiveTranscripts = false;
    this.audioCursorSeconds = 0;
    this.liveTranscriptBoundarySeconds = 0;
    this.resetSpeakerFusionState();
  }

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

  private getDeepgramRawSpeakerId(words: DeepgramWord[]): number {
    if (words.length === 0) {
      return -1;
    }

    const hasSpeakerField = words.some(
      (w) => w.speaker !== undefined && w.speaker !== null,
    );
    if (!hasSpeakerField) {
      return -1;
    }

    const majority = this.getMajoritySpeaker(words);
    return majority === -1 ? -1 : majority;
  }

  private resetSpeakerFusionState(): void {
    this.speakerMemory = {
      self: [],
      other: [],
    };
  }

  private cosineSimilarity(lhs: number[] | null, rhs: number[] | null): number | null {
    if (!lhs || !rhs || lhs.length === 0 || rhs.length === 0) {
      return null;
    }

    const length = Math.min(lhs.length, rhs.length);
    let dot = 0;
    let lhsNorm = 0;
    let rhsNorm = 0;
    for (let i = 0; i < length; i += 1) {
      const left = lhs[i] ?? 0;
      const right = rhs[i] ?? 0;
      dot += left * right;
      lhsNorm += left * left;
      rhsNorm += right * right;
    }

    if (lhsNorm <= 1e-6 || rhsNorm <= 1e-6) {
      return null;
    }

    return dot / (Math.sqrt(lhsNorm) * Math.sqrt(rhsNorm));
  }

  private normalizeVector(values: number[]): number[] {
    const norm = Math.sqrt(values.reduce((sum, value) => sum + (value * value), 0));
    if (norm <= 1e-6) {
      return values;
    }
    return values.map((value) => value / norm);
  }

  private createSpeakerMemorySample(
    analysis: VoiceprintRangeAnalysis,
    source: SpeakerMemorySource,
    confidence: number,
  ): SpeakerEmbeddingSample | null {
    if (!analysis.embedding || analysis.embedding.length === 0) {
      return null;
    }

    return {
      embedding: this.normalizeVector(analysis.embedding),
      enrollmentSimilarity: analysis.similarity,
      createdAt: Date.now(),
      confidence,
      source,
    };
  }

  private rememberSpeakerSample(
    speaker: Speaker,
    sample: SpeakerEmbeddingSample | null,
  ): void {
    if (!sample) {
      return;
    }

    const nextSamples = [...this.speakerMemory[speaker], sample]
      .sort((a, b) => {
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        return b.createdAt - a.createdAt;
      })
      .slice(0, SPEAKER_MEMORY_LIMIT);
    this.speakerMemory[speaker] = nextSamples;
  }

  private scoreAgainstSpeakerMemory(
    embedding: number[] | null,
    samples: SpeakerEmbeddingSample[],
  ): SpeakerMemoryStats {
    if (!embedding || samples.length === 0) {
      return { topKAvg: null, peak: null, count: samples.length };
    }

    const normalized = this.normalizeVector(embedding);
    const similarities = samples
      .map((sample) => this.cosineSimilarity(normalized, sample.embedding))
      .filter((value): value is number => value != null)
      .sort((a, b) => b - a);

    if (similarities.length === 0) {
      return { topKAvg: null, peak: null, count: samples.length };
    }

    const topK = similarities.slice(0, SPEAKER_MEMORY_TOP_K);
    return {
      topKAvg: topK.reduce((sum, value) => sum + value, 0) / topK.length,
      peak: similarities[0],
      count: samples.length,
    };
  }

  private isWeakSelfMemory(): boolean {
    return (
      this.speakerMemory.self.length > 0 &&
      this.speakerMemory.self.every((sample) => sample.source === 'weak_seed')
    );
  }

  private getBestSelfEnrollmentSimilarity(): number | null {
    const values = this.speakerMemory.self
      .map((sample) => sample.enrollmentSimilarity)
      .filter((value): value is number => value != null);
    if (values.length === 0) {
      return null;
    }
    return Math.max(...values);
  }

  private migrateWeakSelfMemoryToOther(): void {
    const weakSelfSamples = this.speakerMemory.self.map((sample) => ({
      ...sample,
      confidence: Math.min(sample.confidence, 0.45),
      source: 'other_match' as const,
    }));
    this.speakerMemory.self = [];
    for (const sample of weakSelfSamples) {
      this.rememberSpeakerSample('other', sample);
    }
  }

  private getLocalVoiceprintRangeMs(
    words: DeepgramWord[],
  ): { startMs: number; endMs: number } | null {
    const timedWords = words.filter(
      (word) => word.start != null || word.end != null,
    );
    if (timedWords.length === 0) {
      return null;
    }

    const starts = timedWords
      .map((word) => word.start ?? word.end)
      .filter((value): value is number => value != null);
    const ends = timedWords
      .map((word) => word.end ?? word.start)
      .filter((value): value is number => value != null);
    if (starts.length === 0 || ends.length === 0) {
      return null;
    }

    const streamStartSeconds = Math.min(...starts);
    const streamEndSeconds = Math.max(...ends);
    return {
      startMs: Math.max(
        0,
        (streamStartSeconds - this.liveTranscriptBoundarySeconds) * 1000,
      ),
      endMs: Math.max(
        0,
        (streamEndSeconds - this.liveTranscriptBoundarySeconds) * 1000,
      ),
    };
  }

  private async analyzeVoiceprintRange(
    range: { startMs: number; endMs: number } | null,
  ): Promise<VoiceprintRangeAnalysis | null> {
    if (!range) {
      return null;
    }

    try {
      return await voiceprintService.analyzeAudioRange(range.startMs, range.endMs);
    } catch (error) {
      console.warn('[Deepgram] Voiceprint range analysis failed:', error, {
        startMs: range.startMs,
        endMs: range.endMs,
      });
      return null;
    }
  }

  private async resolveFinalSpeaker(words: DeepgramWord[]): Promise<SpeakerResolution> {
    const store = useConversationStore.getState();
    const { forcedSpeaker } = store;
    const voiceprintRange = this.getLocalVoiceprintRangeMs(words);
    const rawId = this.getDeepgramRawSpeakerId(words);

    if (forcedSpeaker) {
      store.setSpeakerDecisionSource('forced');
      return {
        speaker: forcedSpeaker,
        rawId,
        source: 'forced',
        voiceprintSimilarity: null,
        voiceprintDecision: null,
        voiceprintSelfTopKSimilarity: null,
        voiceprintSelfPeakSimilarity: null,
        voiceprintOtherTopKSimilarity: null,
        voiceprintOtherPeakSimilarity: null,
        voiceprintSelfMemoryCount: this.speakerMemory.self.length,
        voiceprintOtherMemoryCount: this.speakerMemory.other.length,
        speakerDecisionReason: 'forced',
        voiceprintRangeStartMs: voiceprintRange?.startMs ?? null,
        voiceprintRangeEndMs: voiceprintRange?.endMs ?? null,
        turnEmbedding: null,
      };
    }

    const analysis = await this.analyzeVoiceprintRange(voiceprintRange);
    if (!analysis?.embedding) {
      const fallbackSpeaker = this.getBufferedFallbackSpeaker();
      store.setSpeakerDecisionSource('deepgram');
      return {
        speaker: fallbackSpeaker,
        rawId,
        source: 'deepgram',
        voiceprintSimilarity: analysis?.similarity ?? null,
        voiceprintDecision: analysis?.label ?? null,
        voiceprintSelfTopKSimilarity: null,
        voiceprintSelfPeakSimilarity: null,
        voiceprintOtherTopKSimilarity: null,
        voiceprintOtherPeakSimilarity: null,
        voiceprintSelfMemoryCount: this.speakerMemory.self.length,
        voiceprintOtherMemoryCount: this.speakerMemory.other.length,
        speakerDecisionReason: 'no_run_embedding',
        voiceprintRangeStartMs: voiceprintRange?.startMs ?? null,
        voiceprintRangeEndMs: voiceprintRange?.endMs ?? null,
        turnEmbedding: null,
      };
    }

    const thresholds = voiceprintService.getSimilarityThresholds();
    const selfStats = this.scoreAgainstSpeakerMemory(
      analysis.embedding,
      this.speakerMemory.self,
    );
    const otherStats = this.scoreAgainstSpeakerMemory(
      analysis.embedding,
      this.speakerMemory.other,
    );
    const enrollmentSimilarity = analysis.similarity;
    const strongSelf =
      enrollmentSimilarity != null && enrollmentSimilarity >= thresholds.high;
    const lowEnrollment =
      enrollmentSimilarity != null && enrollmentSimilarity <= thresholds.low;
    const currentSelfIsWeak = this.isWeakSelfMemory();
    const bestSelfEnrollment = this.getBestSelfEnrollmentSimilarity();
    const shouldMigrateWeakSelf =
      currentSelfIsWeak &&
      enrollmentSimilarity != null &&
      (strongSelf ||
        (bestSelfEnrollment != null &&
          enrollmentSimilarity >= bestSelfEnrollment + SELF_MIGRATION_MARGIN)) &&
      (selfStats.topKAvg == null ||
        selfStats.topKAvg <= SELF_MIGRATION_DISSIMILARITY_THRESHOLD);

    let nextSpeaker: Speaker = 'other';
    let memorySource: SpeakerMemorySource | null = null;
    let shouldRemember = false;
    let reason = 'default_other';

    if (strongSelf || shouldMigrateWeakSelf) {
      if (shouldMigrateWeakSelf) {
        this.migrateWeakSelfMemoryToOther();
        reason = 'self_migration';
      } else {
        reason = 'strong_enrollment';
      }
      nextSpeaker = 'self';
      memorySource = strongSelf ? 'strong_enrollment' : 'weak_seed';
      shouldRemember = true;
    } else {
      const selfMemoryHigh =
        selfStats.topKAvg != null &&
        (selfStats.topKAvg >= SELF_MEMORY_MATCH_THRESHOLD ||
          ((selfStats.peak ?? 0) >= SELF_MEMORY_PEAK_THRESHOLD &&
            selfStats.topKAvg >= SELF_MEMORY_SUPPORT_THRESHOLD));
      const selfBeatsOther =
        otherStats.topKAvg == null ||
        selfStats.topKAvg == null ||
        selfStats.topKAvg >= otherStats.topKAvg + MEMORY_SIMILARITY_MARGIN;

      if (selfMemoryHigh && selfBeatsOther) {
        nextSpeaker = 'self';
        memorySource = 'self_match';
        shouldRemember = true;
        reason = 'self_memory_match';
      } else if (
        this.speakerMemory.self.length === 0 &&
        enrollmentSimilarity != null &&
        enrollmentSimilarity >= WEAK_SELF_SEED_MIN_SIMILARITY
      ) {
        nextSpeaker = 'self';
        memorySource = 'weak_seed';
        shouldRemember = true;
        reason = 'weak_self_seed';
      } else {
        const otherMemoryHigh =
          otherStats.topKAvg != null &&
          otherStats.topKAvg >= OTHER_MEMORY_MATCH_THRESHOLD &&
          (selfStats.topKAvg == null ||
            otherStats.topKAvg >= selfStats.topKAvg + MEMORY_SIMILARITY_MARGIN);

        nextSpeaker = 'other';
        if (otherMemoryHigh) {
          memorySource = 'other_match';
          shouldRemember = true;
          reason = 'other_memory_match';
        } else if (lowEnrollment) {
          memorySource = 'low_enrollment';
          shouldRemember = true;
          reason = 'low_enrollment_other';
        } else {
          reason = 'ambiguous_other';
        }
      }
    }

    if (shouldRemember && memorySource) {
      this.rememberSpeakerSample(
        nextSpeaker,
        this.createSpeakerMemorySample(
          analysis,
          memorySource,
          memorySource === 'strong_enrollment'
            ? 0.95
            : memorySource === 'weak_seed'
              ? 0.75
              : nextSpeaker === 'self'
                ? 0.85
                : 0.65,
        ),
      );
    }

    const resolution: SpeakerResolution = {
      speaker: nextSpeaker,
      rawId,
      source: 'voiceprint',
      voiceprintSimilarity: enrollmentSimilarity,
      voiceprintDecision: analysis.label,
      voiceprintSelfTopKSimilarity: selfStats.topKAvg,
      voiceprintSelfPeakSimilarity: selfStats.peak,
      voiceprintOtherTopKSimilarity: otherStats.topKAvg,
      voiceprintOtherPeakSimilarity: otherStats.peak,
      voiceprintSelfMemoryCount: this.speakerMemory.self.length,
      voiceprintOtherMemoryCount: this.speakerMemory.other.length,
      speakerDecisionReason: reason,
      voiceprintRangeStartMs: analysis.audioStartMs,
      voiceprintRangeEndMs: analysis.audioEndMs,
      turnEmbedding: analysis.embedding,
    };

    store.setSpeakerDecisionSource(resolution.source);

    console.log('[Deepgram] Speaker voiceprint resolution', {
      rawId,
      speaker: resolution.speaker,
      vp: enrollmentSimilarity != null
        ? Number(enrollmentSimilarity.toFixed(3))
        : null,
      vpDecision: analysis.label,
      selfTopK: selfStats.topKAvg != null
        ? Number(selfStats.topKAvg.toFixed(3))
        : null,
      otherTopK: otherStats.topKAvg != null
        ? Number(otherStats.topKAvg.toFixed(3))
        : null,
      selfMemory: selfStats.count,
      otherMemory: otherStats.count,
      reason,
    });

    return resolution;
  }

  private determineInterimSpeaker(words: DeepgramWord[]): SpeakerResolution {
    const store = useConversationStore.getState();
    const { forcedSpeaker } = store;
    const voiceprintRange = this.getLocalVoiceprintRangeMs(words);
    const voiceprint = voiceprintRange
      ? voiceprintService.getDecisionForAudioRange(
          voiceprintRange.startMs,
          voiceprintRange.endMs,
        )
      : voiceprintService.getCurrentDecision();
    const rawId = this.getDeepgramRawSpeakerId(words);

    if (forcedSpeaker) {
      store.setSpeakerDecisionSource('forced');
      return {
        speaker: forcedSpeaker,
        rawId,
        source: 'forced',
        voiceprintSimilarity: voiceprint.similarity,
        voiceprintDecision: voiceprint.label,
        voiceprintSelfTopKSimilarity: null,
        voiceprintSelfPeakSimilarity: null,
        voiceprintOtherTopKSimilarity: null,
        voiceprintOtherPeakSimilarity: null,
        voiceprintSelfMemoryCount: this.speakerMemory.self.length,
        voiceprintOtherMemoryCount: this.speakerMemory.other.length,
        speakerDecisionReason: 'forced',
        voiceprintRangeStartMs: voiceprintRange?.startMs ?? null,
        voiceprintRangeEndMs: voiceprintRange?.endMs ?? null,
        turnEmbedding: null,
      };
    }

    const speaker =
      voiceprint.label === 'self'
        ? 'self'
        : voiceprint.label === 'other'
          ? 'other'
          : this.getBufferedFallbackSpeaker();
    const source = voiceprint.label === 'unknown' ? 'deepgram' : 'voiceprint';
    store.setSpeakerDecisionSource(source);

    return {
      speaker,
      rawId,
      source,
      voiceprintSimilarity: voiceprint.similarity,
      voiceprintDecision: voiceprint.label,
      voiceprintSelfTopKSimilarity: null,
      voiceprintSelfPeakSimilarity: null,
      voiceprintOtherTopKSimilarity: null,
      voiceprintOtherPeakSimilarity: null,
      voiceprintSelfMemoryCount: this.speakerMemory.self.length,
      voiceprintOtherMemoryCount: this.speakerMemory.other.length,
      speakerDecisionReason:
        voiceprint.label === 'unknown' ? 'interim_fallback' : 'interim_voiceprint',
      voiceprintRangeStartMs: voiceprintRange?.startMs ?? null,
      voiceprintRangeEndMs: voiceprintRange?.endMs ?? null,
      turnEmbedding: null,
    };
  }
}

export const deepgramService = new DeepgramStreamingService();
