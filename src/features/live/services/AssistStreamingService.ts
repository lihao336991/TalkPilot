import { StreamingWebSocketClient } from '@/features/live/services/StreamingWebSocketClient';
import { useConversationStore } from '@/features/live/store/conversationStore';
import {
  getDeepgramLanguage,
  getDeviceLanguageTag,
} from '@/shared/locale/deviceLanguage';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

type DeepgramMessage = {
  type: string;
  channel?: {
    alternatives: Array<{
      transcript: string;
    }>;
  };
  is_final?: boolean;
};

type AssistCaptureResult = {
  transcript: string;
  sourceLanguage: string;
};

type AssistCaptureState = {
  id: number;
  sourceLanguage: string;
  latestTranscript: string;
  finalTranscript: string;
  awaitingFinalization: boolean;
  resolve?: (result: AssistCaptureResult) => void;
  settleTimer: ReturnType<typeof setTimeout> | null;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
};

const ASSIST_FINALIZE_SETTLE_MS = 250;
const ASSIST_FINALIZE_TIMEOUT_MS = 1_500;

function mergeTranscriptSegments(existing: string, incoming: string): string {
  const base = existing.trim();
  const next = incoming.trim();

  if (!base) {
    return next;
  }

  if (!next) {
    return base;
  }

  if (base === next) {
    return base;
  }

  if (next.startsWith(base)) {
    return next;
  }

  if (base.endsWith(next)) {
    return base;
  }

  return `${base} ${next}`.replace(/\s+/g, ' ').trim();
}

export class AssistStreamingService {
  private client = new StreamingWebSocketClient((status) => {
    useConversationStore.getState().setAssistWsStatus(status);
  });
  private captureSequence = 0;
  private activeCapture: AssistCaptureState | null = null;

  connect(token: string): Promise<void> {
    if (this.client.canResumeWithoutReconnect()) {
      return Promise.resolve();
    }

    const deepgramLang = getDeepgramLanguage();
    const url =
      `wss://api.deepgram.com/v1/listen?` +
      `model=nova-2&language=${deepgramLang}&smart_format=true&interim_results=true` +
      `&utterance_end_ms=1000&vad_events=true&punctuate=true` +
      `&encoding=linear16&sample_rate=16000&channels=1`;

    return this.client.connect({
      url,
      webSocketOptions: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      reconnect: {
        enabled: true,
        maxAttempts: 3,
        delayMs: 1_200,
        shouldReconnect: (event) =>
          !('code' in event) || ![1000, 1001].includes(event.code),
      },
      keepAlive: {
        payload: '{"type":"KeepAlive"}',
        intervalMs: 8_000,
      },
      connectErrorMessage: 'Assist WebSocket failed to connect',
      closeBeforeOpenMessage: (event) =>
        `Assist WebSocket closed before ready (${event.code})`,
      onOpen: () => {
        console.log('[AssistWS] WebSocket connected');
      },
      onMessage: (event) => {
        this.handleMessage(event);
      },
      onError: (event) => {
        console.error('[AssistWS] WebSocket error:', event);
      },
      onClose: (event) => {
        console.log(
          '[AssistWS] WebSocket closed, code:',
          event.code,
          'reason:',
          event.reason,
        );
      },
    });
  }

  startCapture(): void {
    this.resetCaptureState();
    this.activeCapture = {
      id: this.captureSequence + 1,
      sourceLanguage: getDeviceLanguageTag(),
      latestTranscript: '',
      finalTranscript: '',
      awaitingFinalization: false,
      settleTimer: null,
      timeoutTimer: null,
    };
    this.captureSequence += 1;
  }

  sendAudio(base64Data: string): void {
    if (!this.activeCapture) {
      return;
    }

    try {
      const buffer = base64ToArrayBuffer(base64Data);
      this.client.send(buffer);
    } catch (error) {
      console.error('[AssistWS] Failed to send audio chunk:', error);
    }
  }

  async finishCapture(): Promise<AssistCaptureResult> {
    const capture = this.activeCapture;
    if (!capture) {
      return {
        transcript: '',
        sourceLanguage: getDeviceLanguageTag(),
      };
    }

    capture.awaitingFinalization = true;
    const didFinalize = this.client.send('{"type":"Finalize"}');
    if (!didFinalize) {
      return this.completeCapture(capture);
    }

    return new Promise<AssistCaptureResult>((resolve) => {
      capture.resolve = resolve;
      capture.timeoutTimer = setTimeout(() => {
        void this.completeCapture(capture);
      }, ASSIST_FINALIZE_TIMEOUT_MS);

      if (capture.finalTranscript.trim()) {
        this.scheduleCaptureSettlement(capture);
      }
    });
  }

  beginPausedRetention(idleTimeoutMs: number, onTimeout?: () => void): void {
    this.client.beginPausedRetention(idleTimeoutMs, onTimeout);
  }

  cancelPausedRetention(): void {
    this.client.cancelPausedRetention();
  }

  canResumeWithoutReconnect(): boolean {
    return this.client.canResumeWithoutReconnect();
  }

  getPreviewTranscript(): string {
    if (!this.activeCapture) {
      return '';
    }

    return (
      this.activeCapture.finalTranscript.trim() ||
      this.activeCapture.latestTranscript.trim()
    );
  }

  disconnect(): void {
    this.resetCaptureState();
    this.disconnectClient();
  }

  cancelCapture(): void {
    this.resetCaptureState();
    this.disconnectClient();
  }

  private handleMessage(event: MessageEvent) {
    const capture = this.activeCapture;
    if (!capture) {
      return;
    }

    const data: DeepgramMessage = JSON.parse(event.data);
    if (data.type === 'Results') {
      const transcript = data.channel?.alternatives[0]?.transcript ?? '';
      const trimmedTranscript = transcript.trim();
      if (!trimmedTranscript) {
        return;
      }

      capture.latestTranscript = trimmedTranscript;

      if (data.is_final) {
        capture.finalTranscript = mergeTranscriptSegments(
          capture.finalTranscript,
          trimmedTranscript,
        );

        if (capture.awaitingFinalization) {
          this.scheduleCaptureSettlement(capture);
        }
      }
    }

    if (data.type === 'UtteranceEnd' && capture.awaitingFinalization) {
      void this.completeCapture(capture);
    }
  }

  private scheduleCaptureSettlement(capture: AssistCaptureState) {
    if (!this.isCurrentCapture(capture)) {
      return;
    }

    if (capture.settleTimer) {
      clearTimeout(capture.settleTimer);
    }

    capture.settleTimer = setTimeout(() => {
      void this.completeCapture(capture);
    }, ASSIST_FINALIZE_SETTLE_MS);
  }

  private async completeCapture(
    capture: AssistCaptureState,
  ): Promise<AssistCaptureResult> {
    if (!this.isCurrentCapture(capture)) {
      return {
        transcript: '',
        sourceLanguage: capture.sourceLanguage,
      };
    }

    const result = {
      transcript:
        capture.finalTranscript.trim() || capture.latestTranscript.trim(),
      sourceLanguage: capture.sourceLanguage,
    };
    const resolve = capture.resolve;
    this.clearCaptureTimers(capture);
    this.activeCapture = null;
    resolve?.(result);
    return result;
  }

  private resetCaptureState() {
    if (this.activeCapture) {
      const capture = this.activeCapture;
      this.clearCaptureTimers(this.activeCapture);
      this.activeCapture = null;
      capture.resolve?.({
        transcript: '',
        sourceLanguage: capture.sourceLanguage,
      });
    }
  }

  private clearCaptureTimers(capture: AssistCaptureState) {
    if (capture.settleTimer) {
      clearTimeout(capture.settleTimer);
      capture.settleTimer = null;
    }

    if (capture.timeoutTimer) {
      clearTimeout(capture.timeoutTimer);
      capture.timeoutTimer = null;
    }
  }

  private isCurrentCapture(capture: AssistCaptureState) {
    return this.activeCapture?.id === capture.id;
  }

  private disconnectClient() {
    this.client.disconnect({
      beforeClose: (socket) => {
        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }

        // Drop any server-side buffered transcript so the next press starts clean.
        try {
          socket.send('{"type":"Finalize"}');
        } catch {}
      },
    });
  }
}

export const assistStreamingService = new AssistStreamingService();
