import { useAccessStore } from '@/features/live/store/accessStore';
import {
  normalizeFeatureAccess,
  toFeatureAccessError,
} from '@/shared/billing/access';
import type { FeatureAccessEnvelope } from '@/shared/billing/accessTypes';
import { useDebugStore } from '@/features/live/store/debugStore';
import {
  buildLlmDebugHeaders,
  formatLlmMetaDetail,
} from '@/shared/llm/debugConfig';
import { invokeEdgeFunction } from '@/shared/api/request';
import {
  type Suggestion,
  useSuggestionStore,
} from '@/features/live/store/suggestionStore';
import { useSessionStore } from '@/features/live/store/sessionStore';
import { useLocaleStore } from '@/shared/store/localeStore';
import { useAuthStore } from '@/shared/store/authStore';
import { useLlmDebugStore } from '@/shared/store/llmDebugStore';
import { getOrCreateInstallId } from '@/shared/device/installId';
import { analytics } from '@/shared/analytics/analytics';

function getHeaderValue(headers: Headers, key: string) {
  return headers.get(key) ?? headers.get(key.toLowerCase()) ?? null;
}

function isSuggestion(value: unknown): value is Suggestion {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    (candidate.style === 'formal' ||
      candidate.style === 'casual' ||
      candidate.style === 'simple') &&
    typeof candidate.text === 'string'
  );
}

export class SuggestionService {
  async fetchSuggestions(
    sessionId: string,
    lastUtterance: string,
    scene: string,
    turnId: string,
  ): Promise<void> {
    const store = useSuggestionStore.getState();
    const accessToken = useAuthStore.getState().accessToken;
    const { learningLanguage } = useLocaleStore.getState();
    const installId = await getOrCreateInstallId();

    store.startLoading(turnId);

    console.log('[Suggestion] Fetching for session', sessionId);
    analytics.capture('llm_suggest_requested', {
      scene: scene || null,
      learning_language: learningLanguage,
    });
    try {
      const { data: payload, headers } = await invokeEdgeFunction<
        FeatureAccessEnvelope & {
        suggestions?: unknown[];
      }>({
        functionName: 'suggest',
        accessToken,
        headers: buildLlmDebugHeaders(useLlmDebugStore.getState()),
        body: {
          installId,
          sessionId,
          lastUtterance,
          scene,
          learningLanguage,
        },
      });

      const access = normalizeFeatureAccess(payload, 'suggestion');
      if (access) {
        useAccessStore.getState().setFeatureAccess(access);
      }
      const llmMeta = formatLlmMetaDetail(headers);
      const suggestions = Array.isArray(payload?.suggestions)
        ? payload.suggestions.filter(isSuggestion)
        : [];
      const isStillCurrent = useSuggestionStore.getState().triggerTurnId === turnId;
      const isCopilotEnabled = useSessionStore.getState().copilotEnabled;
      console.log('[Suggestion] Received suggestions:', suggestions.length, llmMeta);
      analytics.capture('llm_suggest_succeeded', {
        suggestion_count: suggestions.length,
        llm_provider: getHeaderValue(headers, 'X-LLM-Provider'),
        llm_model: getHeaderValue(headers, 'X-LLM-Model'),
        llm_route_mode: getHeaderValue(headers, 'X-LLM-Route-Mode'),
      });
      useDebugStore
        .getState()
        .completeTurnLlm(
          turnId,
          [llmMeta, `${suggestions.length} suggestion(s)`].filter(Boolean).join(' · '),
        );
      if (!isCopilotEnabled) {
        store.clear();
        return;
      }
      if (isStillCurrent) {
        store.finalizeSuggestions(suggestions);
      }
    } catch (error) {
      const accessError = toFeatureAccessError(error, 'suggestion');
      if (accessError) {
        useAccessStore.getState().setFeatureAccess(accessError.access);
      }
      console.error('[Suggestion] Failed:', error);
      analytics.captureError('llm_suggest_failed', error, {
        scene: scene || null,
        learning_language: learningLanguage,
      });
      const detail = error instanceof Error ? error.message : 'Suggestion request failed';
      useDebugStore.getState().failTurnLlm(turnId, detail);
      if (useSuggestionStore.getState().triggerTurnId === turnId) {
        store.finalizeSuggestions([]);
      }
      throw accessError ?? error;
    }
  }
}

export const suggestionService = new SuggestionService();
