import { NativeModules, Platform } from 'react-native';

import { useConversationStore } from '@/features/live/store/conversationStore';
import { useReviewStore } from '@/features/live/store/reviewStore';
import { useSessionStore, type ScenePreset, type SessionStatus } from '@/features/live/store/sessionStore';
import { useSuggestionStore, type Suggestion } from '@/features/live/store/suggestionStore';

type LiveActivityModuleShape = {
  sync(payloadJSON: string): Promise<boolean>;
  end(): Promise<boolean>;
};

type LiveActivityPayload = {
  sceneName: string;
  startedAtMs: number;
  sessionStatus: Extract<SessionStatus, 'active' | 'paused'>;
  isListening: boolean;
  copilotEnabled: boolean;
  turnCount: number;
  latestSpeaker: 'self' | 'other' | 'system';
  latestMessage: string;
  latestTranslation: string | null;
  latestTranslationIsLoading: boolean;
  latestMessageAtMs: number | null;
  suggestionStyle: Suggestion['style'] | null;
  suggestionText: string | null;
  suggestionIsLoading: boolean;
  reviewScore: 'green' | 'yellow' | 'red' | null;
  reviewSummary: string | null;
  reviewIssueCount: number;
  reviewIsLoading: boolean;
};

const liveActivityModule: LiveActivityModuleShape | undefined =
  Platform.OS === 'ios'
    ? (NativeModules.LiveActivityModule as LiveActivityModuleShape | undefined)
    : undefined;

const scenePresetLabels: Record<ScenePreset, string> = {
  academic: 'Academic',
  daily: 'Daily',
  professional: 'Professional',
  social: 'Social',
  custom: 'Custom',
  free: 'Free Talk',
};

class LiveActivityService {
  private isObserving = false;
  private lastPayloadSignature: string | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  startObserving(): void {
    if (this.isObserving || !liveActivityModule) {
      return;
    }

    this.isObserving = true;
    const sync = () => {
      if (this.syncTimer) {
        clearTimeout(this.syncTimer);
      }

      this.syncTimer = setTimeout(() => {
        this.syncTimer = null;
        void this.syncFromStores();
      }, 120);
    };

    useSessionStore.subscribe(sync);
    useConversationStore.subscribe(sync);
    useSuggestionStore.subscribe(sync);
    useReviewStore.subscribe(sync);
    sync();
  }

  private async syncFromStores(): Promise<void> {
    if (!liveActivityModule) {
      return;
    }

    const payload = this.buildPayload();
    if (!payload) {
      if (this.lastPayloadSignature === null) {
        return;
      }

      this.lastPayloadSignature = null;
      try {
        await liveActivityModule.end();
      } catch (error) {
        console.warn('[LiveActivity] Failed to end activity:', error);
      }
      return;
    }

    const signature = JSON.stringify(payload);
    if (signature === this.lastPayloadSignature) {
      return;
    }

    this.lastPayloadSignature = signature;
    try {
      await liveActivityModule.sync(signature);
    } catch (error) {
      console.warn('[LiveActivity] Failed to sync activity:', error);
    }
  }

  private buildPayload(): LiveActivityPayload | null {
    const session = useSessionStore.getState();
    if (session.status !== 'active' && session.status !== 'paused') {
      return null;
    }

    const conversation = useConversationStore.getState();
    const suggestions = useSuggestionStore.getState();
    const review = useReviewStore.getState();
    const latestTurn = [...conversation.turns]
      .reverse()
      .find((turn) => turn.isFinal);
    const primarySuggestion = suggestions.suggestions[0] ?? null;
    const currentReview = latestTurn?.review ?? review.currentReview;

    return {
      sceneName: this.resolveSceneName(session.sceneDescription, session.scenePreset),
      startedAtMs: session.startedAt ?? Date.now(),
      sessionStatus: session.status,
      isListening: conversation.isListening,
      copilotEnabled: session.copilotEnabled,
      turnCount: conversation.turns.filter((turn) => turn.isFinal).length,
      latestSpeaker: latestTurn?.speaker ?? 'system',
      latestMessage:
        latestTurn?.text ??
        (session.status === 'paused'
          ? 'Session paused. TalkPilot is ready when you come back.'
          : 'Listening for the next message...'),
      latestTranslation: this.normalizeOptionalText(latestTurn?.translation),
      latestTranslationIsLoading: latestTurn?.translationStatus === 'loading',
      latestMessageAtMs: latestTurn?.timestamp ?? null,
      suggestionStyle: primarySuggestion?.style ?? null,
      suggestionText: this.normalizeOptionalText(primarySuggestion?.text),
      suggestionIsLoading: suggestions.isLoading,
      reviewScore: currentReview?.overallScore ?? null,
      reviewSummary: this.resolveReviewSummary(currentReview),
      reviewIssueCount: currentReview?.issues.length ?? 0,
      reviewIsLoading: review.isLoading,
    };
  }

  private resolveSceneName(sceneDescription: string, scenePreset: ScenePreset): string {
    const trimmedDescription = sceneDescription.trim();
    if (trimmedDescription.length > 0) {
      return trimmedDescription;
    }

    return scenePresetLabels[scenePreset] ?? 'Live Session';
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    const trimmed = value?.trim() ?? '';
    return trimmed.length > 0 ? trimmed : null;
  }

  private resolveReviewSummary(review: ReturnType<typeof useReviewStore.getState>['currentReview']): string | null {
    if (!review) {
      return null;
    }

    const betterExpression = this.normalizeOptionalText(review.betterExpression);
    if (betterExpression) {
      return betterExpression;
    }

    const firstIssue = review.issues[0];
    if (firstIssue) {
      return firstIssue.corrected.trim() || firstIssue.explanation.trim() || null;
    }

    return this.normalizeOptionalText(review.praise);
  }
}

export const liveActivityService = new LiveActivityService();
