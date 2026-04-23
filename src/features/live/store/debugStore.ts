import { create } from 'zustand';
import type {
  SpeakerDecisionSource,
  VoiceprintDecisionLabel,
} from './conversationStore';

type StepStatus = 'running' | 'done' | 'error';
type TurnSpeaker = 'self' | 'other';
type TurnLlmKind = 'suggest' | 'review';
type TurnLlmStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped';

type DebugStep = {
  key: string;
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
  timestamp: number;
  completedAt?: number;
};

export type DebugTurnTrace = {
  turnId: string;
  speaker: TurnSpeaker;
  textPreview: string;
  recordingStartedAt: number;
  asrFinalAt?: number;
  utteranceEndAt?: number;
  llmKind?: TurnLlmKind;
  llmStartedAt?: number;
  llmCompletedAt?: number;
  llmStatus: TurnLlmStatus;
  llmDetail?: string;
  voiceprintSimilarity?: number | null;
  voiceprintDecision?: VoiceprintDecisionLabel | null;
  speakerDecisionSource?: SpeakerDecisionSource;
  createdAt: number;
};

type DebugState = {
  steps: DebugStep[];
  turnTraces: DebugTurnTrace[];
  startStep: (id: string, label: string) => void;
  completeStep: (id: string, detail?: string) => void;
  failStep: (id: string, errorMessage: string) => void;
  registerTurnTrace: (trace: {
    turnId: string;
    speaker: TurnSpeaker;
    textPreview: string;
    recordingStartedAt: number;
    asrFinalAt: number;
    voiceprintSimilarity?: number | null;
    voiceprintDecision?: VoiceprintDecisionLabel | null;
    speakerDecisionSource?: SpeakerDecisionSource;
  }) => void;
  markUtteranceEnd: (turnId: string) => void;
  startTurnLlm: (turnId: string, kind: TurnLlmKind) => void;
  completeTurnLlm: (turnId: string, detail?: string) => void;
  failTurnLlm: (turnId: string, errorMessage: string) => void;
  reset: () => void;
};

const MAX_TURN_TRACES = 8;

function updateLatestStep(
  steps: DebugStep[],
  id: string,
  updater: (step: DebugStep) => DebugStep,
) {
  let matched = false;

  return [...steps].reverse().map((step) => {
    if (!matched && step.id === id) {
      matched = true;
      return updater(step);
    }

    return step;
  }).reverse();
}

function upsertTrace(
  traces: DebugTurnTrace[],
  turnId: string,
  updater: (existing?: DebugTurnTrace) => DebugTurnTrace,
) {
  const existing = traces.find((trace) => trace.turnId === turnId);
  const nextTrace = updater(existing);
  const filtered = traces.filter((trace) => trace.turnId !== turnId);
  const next = [...filtered, nextTrace].sort((a, b) => a.createdAt - b.createdAt);

  if (next.length > MAX_TURN_TRACES) {
    return next.slice(next.length - MAX_TURN_TRACES);
  }

  return next;
}

export const useDebugStore = create<DebugState>((set) => ({
  steps: [],
  turnTraces: [],

  startStep: (id, label) =>
    set((state) => ({
      steps: [
        ...state.steps,
        {
          key: `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          id,
          label,
          status: 'running' as StepStatus,
          timestamp: Date.now(),
        },
      ],
    })),

  completeStep: (id, detail) =>
    set((state) => ({
      steps: updateLatestStep(state.steps, id, (s) => ({
        ...s,
        status: 'done' as StepStatus,
        detail,
        completedAt: Date.now(),
      })),
    })),

  failStep: (id, errorMessage) =>
    set((state) => ({
      steps: updateLatestStep(state.steps, id, (s) => ({
        ...s,
        status: 'error' as StepStatus,
        detail: errorMessage,
        completedAt: Date.now(),
      })),
    })),

  registerTurnTrace: ({
    turnId,
    speaker,
    textPreview,
    recordingStartedAt,
    asrFinalAt,
    voiceprintSimilarity,
    voiceprintDecision,
    speakerDecisionSource,
  }) =>
    set((state) => ({
      turnTraces: upsertTrace(state.turnTraces, turnId, (existing) => ({
        turnId,
        speaker,
        textPreview,
        recordingStartedAt: existing?.recordingStartedAt ?? recordingStartedAt,
        asrFinalAt,
        utteranceEndAt: existing?.utteranceEndAt,
        llmKind: existing?.llmKind,
        llmStartedAt: existing?.llmStartedAt,
        llmCompletedAt: existing?.llmCompletedAt,
        llmStatus: existing?.llmStatus ?? 'idle',
        llmDetail: existing?.llmDetail,
        voiceprintSimilarity:
          voiceprintSimilarity ?? existing?.voiceprintSimilarity ?? null,
        voiceprintDecision:
          voiceprintDecision ?? existing?.voiceprintDecision ?? null,
        speakerDecisionSource:
          speakerDecisionSource ?? existing?.speakerDecisionSource ?? null,
        createdAt: existing?.createdAt ?? asrFinalAt,
      })),
    })),

  markUtteranceEnd: (turnId) =>
    set((state) => ({
      turnTraces: upsertTrace(state.turnTraces, turnId, (existing) => ({
        turnId,
        speaker: existing?.speaker ?? 'other',
        textPreview: existing?.textPreview ?? '',
        recordingStartedAt: existing?.recordingStartedAt ?? Date.now(),
        asrFinalAt: existing?.asrFinalAt,
        utteranceEndAt: Date.now(),
        llmKind: existing?.llmKind,
        llmStartedAt: existing?.llmStartedAt,
        llmCompletedAt: existing?.llmCompletedAt,
        llmStatus: existing?.llmStatus ?? 'idle',
        llmDetail: existing?.llmDetail,
        voiceprintSimilarity: existing?.voiceprintSimilarity ?? null,
        voiceprintDecision: existing?.voiceprintDecision ?? null,
        speakerDecisionSource: existing?.speakerDecisionSource ?? null,
        createdAt: existing?.createdAt ?? Date.now(),
      })),
    })),

  startTurnLlm: (turnId, kind) =>
    set((state) => ({
      turnTraces: upsertTrace(state.turnTraces, turnId, (existing) => ({
        turnId,
        speaker: existing?.speaker ?? 'other',
        textPreview: existing?.textPreview ?? '',
        recordingStartedAt: existing?.recordingStartedAt ?? Date.now(),
        asrFinalAt: existing?.asrFinalAt,
        utteranceEndAt: existing?.utteranceEndAt,
        llmKind: kind,
        llmStartedAt: Date.now(),
        llmCompletedAt: undefined,
        llmStatus: 'running',
        llmDetail: undefined,
        voiceprintSimilarity: existing?.voiceprintSimilarity ?? null,
        voiceprintDecision: existing?.voiceprintDecision ?? null,
        speakerDecisionSource: existing?.speakerDecisionSource ?? null,
        createdAt: existing?.createdAt ?? Date.now(),
      })),
    })),

  completeTurnLlm: (turnId, detail) =>
    set((state) => ({
      turnTraces: upsertTrace(state.turnTraces, turnId, (existing) => ({
        turnId,
        speaker: existing?.speaker ?? 'other',
        textPreview: existing?.textPreview ?? '',
        recordingStartedAt: existing?.recordingStartedAt ?? Date.now(),
        asrFinalAt: existing?.asrFinalAt,
        utteranceEndAt: existing?.utteranceEndAt,
        llmKind: existing?.llmKind,
        llmStartedAt: existing?.llmStartedAt,
        llmCompletedAt: Date.now(),
        llmStatus: 'done',
        llmDetail: detail,
        voiceprintSimilarity: existing?.voiceprintSimilarity ?? null,
        voiceprintDecision: existing?.voiceprintDecision ?? null,
        speakerDecisionSource: existing?.speakerDecisionSource ?? null,
        createdAt: existing?.createdAt ?? Date.now(),
      })),
    })),

  failTurnLlm: (turnId, errorMessage) =>
    set((state) => ({
      turnTraces: upsertTrace(state.turnTraces, turnId, (existing) => ({
        turnId,
        speaker: existing?.speaker ?? 'other',
        textPreview: existing?.textPreview ?? '',
        recordingStartedAt: existing?.recordingStartedAt ?? Date.now(),
        asrFinalAt: existing?.asrFinalAt,
        utteranceEndAt: existing?.utteranceEndAt,
        llmKind: existing?.llmKind,
        llmStartedAt: existing?.llmStartedAt,
        llmCompletedAt: Date.now(),
        llmStatus: 'error',
        llmDetail: errorMessage,
        voiceprintSimilarity: existing?.voiceprintSimilarity ?? null,
        voiceprintDecision: existing?.voiceprintDecision ?? null,
        speakerDecisionSource: existing?.speakerDecisionSource ?? null,
        createdAt: existing?.createdAt ?? Date.now(),
      })),
    })),

  reset: () => set({ steps: [], turnTraces: [] }),
}));
