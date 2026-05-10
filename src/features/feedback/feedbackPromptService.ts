import AsyncStorage from "@react-native-async-storage/async-storage";

import { useFeedbackStore, type FeedbackContext } from "@/features/feedback/feedbackStore";

const STORAGE_KEY = "talkpilot.feedback.promptState.v1";
const AUTO_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_AUTO_PROMPT_DURATION_SECONDS = 60;
const MIN_SESSIONS_BETWEEN_PROMPTS = 3;

type PromptState = {
  lastAutoPromptAt: number | null;
  endedSessionsSincePrompt: number;
};

const defaultPromptState: PromptState = {
  lastAutoPromptAt: null,
  endedSessionsSincePrompt: 0,
};

async function readPromptState(): Promise<PromptState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultPromptState;
    }

    const parsed = JSON.parse(raw) as Partial<PromptState>;
    return {
      lastAutoPromptAt:
        typeof parsed.lastAutoPromptAt === "number" ? parsed.lastAutoPromptAt : null,
      endedSessionsSincePrompt:
        typeof parsed.endedSessionsSincePrompt === "number"
          ? parsed.endedSessionsSincePrompt
          : 0,
    };
  } catch {
    return defaultPromptState;
  }
}

async function writePromptState(state: PromptState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function maybeOpenLiveSessionFeedback(
  context: FeedbackContext,
  durationSeconds: number,
) {
  const state = await readPromptState();
  const now = Date.now();
  const endedSessionsSincePrompt = state.endedSessionsSincePrompt + 1;
  const cooldownElapsed =
    !state.lastAutoPromptAt ||
    now - state.lastAutoPromptAt >= AUTO_PROMPT_COOLDOWN_MS;
  const hasEnoughSessions =
    endedSessionsSincePrompt >= MIN_SESSIONS_BETWEEN_PROMPTS;
  const hasEnoughDuration = durationSeconds >= MIN_AUTO_PROMPT_DURATION_SECONDS;

  if (!cooldownElapsed || !hasEnoughSessions || !hasEnoughDuration) {
    await writePromptState({ ...state, endedSessionsSincePrompt });
    return;
  }

  await writePromptState({
    lastAutoPromptAt: now,
    endedSessionsSincePrompt: 0,
  });
  useFeedbackStore.getState().openFeedback(context);
}
