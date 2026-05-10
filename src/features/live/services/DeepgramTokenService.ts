import { useAccessStore } from '@/features/live/store/accessStore';
import {
  isFeatureAccessError,
  normalizeFeatureAccess,
  toFeatureAccessError,
} from '@/shared/billing/access';
import { invokeEdgeFunction } from '@/shared/api/request';
import { getValidAccessToken } from '@/shared/api/supabase';
import { applyFeatureAccessSummary } from '@/shared/repositories/billingRepository';
import { getOrCreateInstallId } from '@/shared/device/installId';
import { useAuthStore } from '@/shared/store/authStore';

class DeepgramTokenService {
  private cachedToken: string | null = null;
  private cachedUserId: string | null = null;
  private expiresAt = 0;
  private inflightTokenPromise: Promise<string> | null = null;
  private inflightUserId: string | null = null;

  private hasValidCachedToken() {
    const now = Date.now();
    const currentUserId = useAuthStore.getState().userId;
    return (
      Boolean(this.cachedToken) &&
      this.cachedUserId === currentUserId &&
      now < this.expiresAt - 60_000
    );
  }

  private async fetchToken(requestUserId: string | null): Promise<string> {
    const accessToken = await getValidAccessToken();
    const installId = await getOrCreateInstallId();

    console.log('[DeepgramToken] Fetching token...');

    let body: any = null;
    try {
      const result = await invokeEdgeFunction<any>({
        functionName: 'deepgram-token',
        accessToken,
        body: { installId },
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
      const accessError = toFeatureAccessError(error, 'live_minutes');
      if (!isFeatureAccessError(accessError)) {
        console.error('[DeepgramToken] Function error detail:', requestError);
      }
      throw (
        accessError ??
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
    this.cachedUserId = requestUserId;
    this.expiresAt = Date.now() + (body.expires_in ?? 600) * 1000;
    console.log('[DeepgramToken] Token acquired, expires in', body.expires_in ?? 600, 's');

    return this.cachedToken!;
  }

  prewarm(): void {
    const currentUserId = useAuthStore.getState().userId;
    if (
      this.hasValidCachedToken() ||
      (this.inflightTokenPromise && this.inflightUserId === currentUserId)
    ) {
      return;
    }

    this.inflightUserId = currentUserId;
    this.inflightTokenPromise = this.fetchToken(currentUserId).finally(() => {
      if (this.inflightUserId === currentUserId) {
        this.inflightTokenPromise = null;
        this.inflightUserId = null;
      }
    });
  }

  async getToken(): Promise<string> {
    const currentUserId = useAuthStore.getState().userId;
    if (this.hasValidCachedToken()) {
      return this.cachedToken!;
    }

    if (!this.inflightTokenPromise || this.inflightUserId !== currentUserId) {
      this.inflightUserId = currentUserId;
      this.inflightTokenPromise = this.fetchToken(currentUserId).finally(() => {
        if (this.inflightUserId === currentUserId) {
          this.inflightTokenPromise = null;
          this.inflightUserId = null;
        }
      });
    }

    return this.inflightTokenPromise;
  }

  invalidate(): void {
    this.cachedToken = null;
    this.cachedUserId = null;
    this.expiresAt = 0;
    this.inflightTokenPromise = null;
    this.inflightUserId = null;
  }
}

export const deepgramTokenService = new DeepgramTokenService();
