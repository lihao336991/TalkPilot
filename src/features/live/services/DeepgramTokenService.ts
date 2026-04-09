import { supabase } from '@/shared/api/supabase';
import { useAuthStore } from '@/shared/store/authStore';

class DeepgramTokenService {
  private cachedToken: string | null = null;
  private expiresAt = 0;

  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.expiresAt - 60_000) {
      return this.cachedToken;
    }

    const accessToken = useAuthStore.getState().accessToken;

    const { data, error } = await supabase.functions.invoke('deepgram-token', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (error) {
      throw new Error(`Failed to get Deepgram token: ${error.message}`);
    }

    this.cachedToken = data.deepgram_token;
    this.expiresAt = Date.now() + data.expires_in * 1000;

    return this.cachedToken!;
  }
}

export const deepgramTokenService = new DeepgramTokenService();
