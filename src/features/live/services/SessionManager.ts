import { supabase } from '@/shared/api/supabase';
import { useAuthStore } from '@/shared/store/authStore';
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

class SessionManager {
  private async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async createSession({
    scenePreset,
    sceneDescription,
  }: CreateSessionParams): Promise<string> {
    console.log('[SessionManager] Creating session...');
    const userId = useAuthStore.getState().userId;

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
          status: 'active',
        })
        .select('id')
        .single();

      if (error || !data?.id) {
        throw new Error(error?.message || 'Failed to create session.');
      }

      console.log('[SessionManager] Session created:', data.id);
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
  }: EndSessionParams): Promise<void> {
    console.log('[SessionManager] Ending session', sessionId);
    if (!sessionId) {
      return;
    }

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

      console.log('[SessionManager] Session ended:', sessionId);
    } catch (error) {
      console.error('[SessionManager] Failed to end session:', error);
      throw error;
    }
  }
}

export const sessionManager = new SessionManager();
