import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from '@/shared/api/supabase';
import type { FeatureAccessSummary } from '@/shared/billing/accessTypes';
import { consumeLiveSessionAccess } from '@/shared/repositories/billingRepository';
import { useAuthStore } from '@/shared/store/authStore';
import { useLocaleStore } from '@/shared/store/localeStore';
import type { ScenePreset } from '@/features/live/store/sessionStore';

type CreateSessionParams = {
  scenePreset: ScenePreset;
  sceneDescription?: string;
};

type RecordTurnParams = {
  sessionId: string;
  turnId: string;
  speaker: 'self' | 'other';
  text: string;
  confidence?: number;
};

type EndSessionParams = {
  sessionId: string;
  durationSeconds: number;
};

type PersistedActiveSession = {
  sessionId: string;
  userId: string;
  startedAt: string;
};

const ACTIVE_SESSION_STORAGE_KEY = "talkpilot.live.activeSession";

class SessionManager {
  private async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async getPersistedActiveSession(): Promise<PersistedActiveSession | null> {
    try {
      const raw = await AsyncStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedActiveSession>;
      if (
        !parsed ||
        typeof parsed.sessionId !== "string" ||
        typeof parsed.userId !== "string" ||
        typeof parsed.startedAt !== "string"
      ) {
        await AsyncStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
        return null;
      }

      return {
        sessionId: parsed.sessionId,
        userId: parsed.userId,
        startedAt: parsed.startedAt,
      };
    } catch (error) {
      console.warn("[SessionManager] Failed to read active session cache:", error);
      return null;
    }
  }

  private async persistActiveSession(sessionId: string) {
    const userId = useAuthStore.getState().userId;
    if (!sessionId || !userId) {
      return;
    }

    try {
      const payload: PersistedActiveSession = {
        sessionId,
        userId,
        startedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        ACTIVE_SESSION_STORAGE_KEY,
        JSON.stringify(payload),
      );
    } catch (error) {
      console.warn("[SessionManager] Failed to persist active session:", error);
    }
  }

  async clearActiveSession(sessionId?: string) {
    try {
      const persisted = await this.getPersistedActiveSession();
      if (!persisted) {
        return;
      }

      if (sessionId && persisted.sessionId !== sessionId) {
        return;
      }

      await AsyncStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    } catch (error) {
      console.warn("[SessionManager] Failed to clear active session cache:", error);
    }
  }

  async reconcileDanglingSession() {
    const persisted = await this.getPersistedActiveSession();
    const currentUserId = useAuthStore.getState().userId;

    if (!persisted || !currentUserId || persisted.userId !== currentUserId) {
      return;
    }

    const startedAtMs = Date.parse(persisted.startedAt);
    const durationSeconds =
      Number.isFinite(startedAtMs) && startedAtMs > 0
        ? Math.max(0, Math.round((Date.now() - startedAtMs) / 1000))
        : 0;

    console.log("[SessionManager] Reconciling dangling session:", persisted.sessionId);
    await this.endSession({
      sessionId: persisted.sessionId,
      durationSeconds,
    });
  }

  async touchSessionActivity(sessionId: string): Promise<boolean> {
    if (!sessionId) {
      return false;
    }

    try {
      const { data, error } = await supabase.rpc("touch_session_activity", {
        p_session_id: sessionId,
      });

      if (error) {
        throw new Error(error.message || "Failed to touch session activity.");
      }

      return Boolean(data);
    } catch (error) {
      console.warn("[SessionManager] Failed to touch session activity:", error);
      return false;
    }
  }

  async createSession({
    scenePreset,
    sceneDescription,
  }: CreateSessionParams): Promise<string> {
    console.log('[SessionManager] Creating session...');
    const userId = useAuthStore.getState().userId;
    const { uiLocale, learningLanguage } = useLocaleStore.getState();

    if (!userId) {
      throw new Error('Cannot create session without an authenticated user.');
    }

    try {
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          user_id: userId,
          scene_preset: scenePreset,
          scene_description: sceneDescription || null,
          native_language: uiLocale,
          learning_language: learningLanguage,
          status: 'active',
        })
        .select('id')
        .single();

      if (error || !data?.id) {
        throw new Error(error?.message || 'Failed to create session.');
      }

      console.log('[SessionManager] Session created:', data.id);
      await this.persistActiveSession(data.id);
      return data.id;
    } catch (error) {
      console.error('[SessionManager] Failed to create session:', error);
      throw error;
    }
  }

  async recordTurn({
    sessionId,
    turnId,
    speaker,
    text,
    confidence,
  }: RecordTurnParams): Promise<void> {
    console.log('[SessionManager] Recording turn', turnId, speaker, text.substring(0, 50));
    const trimmedText = text.trim();
    const { userId, accessToken } = useAuthStore.getState();

    if (!sessionId || !turnId || !trimmedText) {
      return;
    }

    const maxAttempts = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const { error } = await supabase.from('turns').insert({
          session_id: sessionId,
          turn_id: turnId,
          speaker,
          text: trimmedText,
          confidence: confidence ?? null,
        });

        if (error) {
          throw new Error(error.message || 'Failed to persist turn.');
        }

        if (attempt > 1) {
          console.log('[SessionManager] Record turn recovered on retry', {
            attempt,
            turnId,
            sessionId,
          });
        }
        return;
      } catch (error) {
        lastError = error;
        console.warn('[SessionManager] Record turn attempt failed', {
          attempt,
          maxAttempts,
          sessionId,
          turnId,
          speaker,
          userId,
          hasAccessToken: Boolean(accessToken),
          message: error instanceof Error ? error.message : String(error),
        });

        if (attempt < maxAttempts) {
          await this.sleep(250 * 2 ** (attempt - 1));
          continue;
        }
      }
    }

    throw lastError;
  }

  async endSession({
    sessionId,
    durationSeconds,
  }: EndSessionParams): Promise<FeatureAccessSummary | null> {
    console.log('[SessionManager] Ending session', sessionId);
    if (!sessionId) {
      return null;
    }

    let didPersistEndState = false;

    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          status: 'ended',
        })
        .eq('id', sessionId);

      if (error) {
        throw new Error(error.message || 'Failed to end session.');
      }

      didPersistEndState = true;
      const accessSummary = await consumeLiveSessionAccess({
        sessionId,
        durationSeconds,
      });

      console.log('[SessionManager] Session ended:', sessionId);
      await this.clearActiveSession(sessionId);
      return accessSummary;
    } catch (error) {
      if (didPersistEndState) {
        await this.clearActiveSession(sessionId);
      }
      console.error('[SessionManager] Failed to end session:', error);
      throw error;
    }
  }
}

export const sessionManager = new SessionManager();
