import { useDebugStore } from '@/features/live/store/debugStore';
import { useSuggestionStore } from '@/features/live/store/suggestionStore';
import { useAuthStore } from '@/shared/store/authStore';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';

function getLlmMetaDetail(headers: Headers): string {
  const provider = headers.get('x-llm-provider');
  const model = headers.get('x-llm-model');
  const keyPrefix = headers.get('x-llm-key-prefix');
  const parts = [provider, model, keyPrefix ? `key ${keyPrefix}` : null].filter(Boolean);

  return parts.join(' · ');
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

    store.startLoading(turnId);

    console.log('[Suggestion] Fetching for session', sessionId);
    const response = await fetch(`${supabaseUrl}/functions/v1/suggest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ sessionId, lastUtterance, scene }),
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        console.error('[Suggestion] Error from server:', errorData);
        detail = errorData?.error ?? errorData?.message ?? detail;
      } catch {
        console.error('[Suggestion] Error from server: HTTP', response.status);
      }
      useDebugStore.getState().failTurnLlm(turnId, detail);
      if (useSuggestionStore.getState().triggerTurnId === turnId) {
        store.finalizeSuggestions([]);
      }
      return;
    }

    try {
      const llmMeta = getLlmMetaDetail(response.headers);
      const payload = await response.json();
      const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
      const isStillCurrent = useSuggestionStore.getState().triggerTurnId === turnId;
      console.log('[Suggestion] Received suggestions:', suggestions.length, llmMeta);
      useDebugStore
        .getState()
        .completeTurnLlm(
          turnId,
          [llmMeta, `${suggestions.length} suggestion(s)`].filter(Boolean).join(' · '),
        );
      if (isStillCurrent) {
        store.finalizeSuggestions(suggestions);
      }
    } catch (error) {
      console.error('[Suggestion] Failed to parse suggestions payload:', error);
      useDebugStore
        .getState()
        .failTurnLlm(
          turnId,
          error instanceof Error ? error.message : 'Failed to parse suggestions',
        );
      if (useSuggestionStore.getState().triggerTurnId === turnId) {
        store.finalizeSuggestions([]);
      }
    }
  }
}

export const suggestionService = new SuggestionService();
