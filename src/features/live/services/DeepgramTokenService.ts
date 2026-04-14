import { getValidAccessToken } from '@/shared/api/supabase';
import { useSessionStore } from '../store/sessionStore';

class DeepgramTokenService {
  private cachedToken: string | null = null;
  private expiresAt = 0;
  private inflightTokenPromise: Promise<string> | null = null;

  private hasValidCachedToken() {
    const now = Date.now();
    return Boolean(this.cachedToken) && now < this.expiresAt - 60_000;
  }

  private async fetchToken(): Promise<string> {
    const accessToken = await getValidAccessToken();
    // #region debug-point D:access-token-shape
    void fetch('http://10.200.4.178:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'deepgram-ws-401', runId: 'post-fix', hypothesisId: 'D', location: 'DeepgramTokenService.ts:14', msg: '[DEBUG] fetched supabase access token before deepgram function', data: { accessTokenLength: accessToken.length, accessTokenHasDot: accessToken.includes('.'), accessTokenPrefix: accessToken.slice(0, 16) }, ts: Date.now() }) }).catch(() => {});
    // #endregion

    console.log('[DeepgramToken] Fetching token...');

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
    const url = `${supabaseUrl}/functions/v1/deepgram-token`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    let body: any = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    // #region debug-point D:function-response-shape
    void fetch('http://10.200.4.178:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'deepgram-ws-401', runId: 'post-fix', hypothesisId: 'D', location: 'DeepgramTokenService.ts:39', msg: '[DEBUG] deepgram token function responded', data: { ok: response.ok, status: response.status, hasBody: Boolean(body), bodyKeys: body ? Object.keys(body) : [], tokenLength: typeof body?.deepgram_token === 'string' ? body.deepgram_token.length : null, tokenHasDot: typeof body?.deepgram_token === 'string' ? body.deepgram_token.includes('.') : null, tokenPrefix: typeof body?.deepgram_token === 'string' ? body.deepgram_token.slice(0, 12) : null, expiresIn: body?.expires_in ?? null }, ts: Date.now() }) }).catch(() => {});
    // #endregion

    if (!response.ok) {
      if (body?.daily_minutes_limit != null) {
        useSessionStore.getState().setUsageSummary({
          minutesUsed: Number(body.minutes_used ?? 0),
          minutesLimit: Number(body.daily_minutes_limit),
        });
      }
      const detail = body?.error ?? body?.message ?? `status ${response.status}`;
      console.error('[DeepgramToken] Function error:', response.status, body);
      throw new Error(`Failed to get Deepgram token: ${detail}`);
    }

    if (body?.usage?.daily_minutes_limit != null) {
      useSessionStore.getState().setUsageSummary({
        minutesUsed: Number(body.usage.minutes_used ?? 0),
        minutesLimit: Number(body.usage.daily_minutes_limit),
      });
    }

    this.cachedToken = body.deepgram_token;
    this.expiresAt = Date.now() + (body.expires_in ?? 600) * 1000;
    const tokenValue = this.cachedToken!;
    // #region debug-point A:token-acquired
    void fetch('http://10.200.4.178:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'deepgram-ws-401', runId: 'post-fix', hypothesisId: 'A', location: 'DeepgramTokenService.ts:50', msg: '[DEBUG] acquired deepgram token for websocket', data: { expiresInMs: this.expiresAt - Date.now(), tokenLength: tokenValue.length, tokenHasDot: tokenValue.includes('.'), tokenPrefix: tokenValue.slice(0, 12) }, ts: Date.now() }) }).catch(() => {});
    // #endregion
    console.log('[DeepgramToken] Token acquired, expires in', body.expires_in ?? 600, 's');

    return this.cachedToken!;
  }

  prewarm(): void {
    if (this.hasValidCachedToken() || this.inflightTokenPromise) {
      return;
    }

    this.inflightTokenPromise = this.fetchToken().finally(() => {
      this.inflightTokenPromise = null;
    });
  }

  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.expiresAt - 60_000) {
      // #region debug-point C:token-cache-hit
      void fetch('http://10.200.4.178:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'deepgram-ws-401', runId: 'post-fix', hypothesisId: 'C', location: 'DeepgramTokenService.ts:10', msg: '[DEBUG] using cached deepgram token', data: { expiresInMs: this.expiresAt - now, tokenLength: this.cachedToken.length, tokenHasDot: this.cachedToken.includes('.'), tokenPrefix: this.cachedToken.slice(0, 12) }, ts: Date.now() }) }).catch(() => {});
      // #endregion
      return this.cachedToken;
    }

    if (!this.inflightTokenPromise) {
      this.inflightTokenPromise = this.fetchToken().finally(() => {
        this.inflightTokenPromise = null;
      });
    }

    return this.inflightTokenPromise;
  }
}

export const deepgramTokenService = new DeepgramTokenService();
