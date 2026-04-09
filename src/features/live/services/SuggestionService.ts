import { useAuthStore } from '@/shared/store/authStore';
import { useSuggestionStore, type Suggestion } from '@/features/live/store/suggestionStore';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';

export class SuggestionService {
  async fetchSuggestions(sessionId: string, lastUtterance: string, scene: string): Promise<void> {
    const store = useSuggestionStore.getState();
    const accessToken = useAuthStore.getState().accessToken;

    store.startLoading(sessionId);

    const response = await fetch(`${supabaseUrl}/functions/v1/suggest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ sessionId, lastUtterance, scene }),
    });

    if (!response.ok || !response.body) {
      store.finalizeSuggestions([]);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            store.appendChunk(data);
          }
        }
      }

      const rawBuffer = useSuggestionStore.getState().streamBuffer;
      let suggestions: Suggestion[] = [];
      try {
        suggestions = JSON.parse(rawBuffer);
      } catch {
        suggestions = [];
      }
      store.finalizeSuggestions(suggestions);
    } catch {
      store.finalizeSuggestions([]);
    }
  }
}

export const suggestionService = new SuggestionService();
