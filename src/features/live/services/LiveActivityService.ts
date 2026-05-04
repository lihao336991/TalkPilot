import { NativeModules, Platform } from 'react-native';

import { useConversationStore } from '@/features/live/store/conversationStore';
import { useSessionStore, type ScenePreset, type SessionStatus } from '@/features/live/store/sessionStore';

type LiveActivityModuleShape = {
  sync(payloadJSON: string): Promise<boolean>;
  end(): Promise<boolean>;
};

type LiveActivityPayload = {
  sceneName: string;
  startedAtMs: number;
  sessionStatus: Extract<SessionStatus, 'active' | 'paused'>;
  latestSpeaker: 'self' | 'other' | 'system';
  latestMessage: string;
  latestMessageAtMs: number | null;
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
    const latestTurn = [...conversation.turns]
      .reverse()
      .find((turn) => turn.isFinal);

    return {
      sceneName: this.resolveSceneName(session.sceneDescription, session.scenePreset),
      startedAtMs: session.startedAt ?? Date.now(),
      sessionStatus: session.status,
      latestSpeaker: latestTurn?.speaker ?? 'system',
      latestMessage:
        latestTurn?.text ??
        (session.status === 'paused'
          ? 'Session paused. TalkPilot is ready when you come back.'
          : 'Listening for the next message...'),
      latestMessageAtMs: latestTurn?.timestamp ?? null,
    };
  }

  private resolveSceneName(sceneDescription: string, scenePreset: ScenePreset): string {
    const trimmedDescription = sceneDescription.trim();
    if (trimmedDescription.length > 0) {
      return trimmedDescription;
    }

    return scenePresetLabels[scenePreset] ?? 'Live Session';
  }
}

export const liveActivityService = new LiveActivityService();
