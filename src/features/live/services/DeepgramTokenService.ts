import { useAccessStore } from '@/features/live/store/accessStore';
import {
  normalizeFeatureAccess,
  toFeatureAccessError,
} from '@/shared/billing/access';
import { invokeEdgeFunction } from '@/shared/api/request';
import { getValidAccessToken } from '@/shared/api/supabase';
import { applyFeatureAccessSummary } from '@/shared/repositories/billingRepository';

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

    console.log('[DeepgramToken] Fetching token...');

    let body: any = null;
    try {
      const result = await invokeEdgeFunction<any>({
        functionName: 'deepgram-token',
        accessToken,
        body: {},
      });
      body = result.data;
    } catch (error) {
      const requestError = error as {
        status?: number;
        body?: unknown;
        message?: string;
      };
      body = requestError.body ?? null;
      if (body && typeof body === 'object') {
        const errorBody = body as Record<string, unknown>;
        const access = normalizeFeatureAccess(errorBody, 'live_minutes');
        if (access) {
          applyFeatureAccessSummary(access);
        }
      }
      console.error('[DeepgramToken] Function error detail:', requestError);
      throw (
        toFeatureAccessError(error, 'live_minutes') ??
        new Error(
          `Failed to get Deepgram token: ${
            requestError.message ?? 'Unknown request failure'
          }`,
        )
      );
    }

    const access = normalizeFeatureAccess(body, 'live_minutes');
    if (access) {
      applyFeatureAccessSummary(access);
    }

    this.cachedToken = body.deepgram_token;
    this.expiresAt = Date.now() + (body.expires_in ?? 600) * 1000;
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
      return this.cachedToken;
    }

    if (!this.inflightTokenPromise) {
      this.inflightTokenPromise = this.fetchToken().finally(() => {
        this.inflightTokenPromise = null;
      });
    }

    return this.inflightTokenPromise;
  }

  invalidate(): void {
    this.cachedToken = null;
    this.expiresAt = 0;
    this.inflightTokenPromise = null;
  }
}

export const deepgramTokenService = new DeepgramTokenService();
