export type StreamingConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'error'
  | 'closed';

type StreamingReconnectOptions = {
  enabled?: boolean;
  maxAttempts?: number;
  delayMs?: number;
  shouldReconnect?: (event: CloseEvent | Event) => boolean;
  onReconnectScheduled?: (attempt: number, delayMs: number) => void;
  onReconnectAttempt?: (attempt: number) => void;
  onReconnectSuccess?: (attempt: number) => void;
  onReconnectExhausted?: (attempts: number) => void;
};

type StreamingKeepAlivePayload =
  | string
  | ArrayBuffer
  | ArrayBufferView
  | (() => string | ArrayBuffer | ArrayBufferView);

type StreamingKeepAliveOptions = {
  payload?: StreamingKeepAlivePayload;
  intervalMs?: number;
};

type StreamingWebSocketConnectOptions = {
  url: string;
  protocols?: string | string[];
  webSocketOptions?: Record<string, unknown>;
  connectErrorMessage?: string;
  closeBeforeOpenMessage?: (event: CloseEvent) => string;
  reconnect?: StreamingReconnectOptions;
  keepAlive?: StreamingKeepAliveOptions;
  onStatusChange?: (status: StreamingConnectionStatus) => void;
  onOpen?: () => void;
  onMessage?: (event: MessageEvent) => void | Promise<void>;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
};

type StreamingWebSocketDisconnectOptions = {
  nextStatus?: StreamingConnectionStatus;
  beforeClose?: (socket: WebSocket) => void;
};

function createSocket({
  url,
  protocols,
  webSocketOptions,
}: Pick<
  StreamingWebSocketConnectOptions,
  'url' | 'protocols' | 'webSocketOptions'
>) {
  return new (WebSocket as any)(url, protocols, webSocketOptions) as WebSocket;
}

export class StreamingWebSocketClient {
  private socket: WebSocket | null = null;
  private pausedDisconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentConnectOptions: StreamingWebSocketConnectOptions | null = null;
  private currentStatus: StreamingConnectionStatus = 'idle';
  private reconnectAttempts = 0;
  private shouldStayDisconnected = false;

  constructor(
    private readonly defaultStatusChangeHandler?: (
      status: StreamingConnectionStatus,
    ) => void,
  ) {}

  private setStatus(
    status: StreamingConnectionStatus,
    onStatusChange?: (status: StreamingConnectionStatus) => void,
  ) {
    this.currentStatus = status;
    this.defaultStatusChangeHandler?.(status);
    onStatusChange?.(status);
  }

  connect(options: StreamingWebSocketConnectOptions): Promise<void> {
    this.cancelPausedRetention();
    this.stopKeepAlive();
    this.cancelReconnect();
    this.closeSocket();
    this.currentConnectOptions = options;
    this.reconnectAttempts = 0;
    this.shouldStayDisconnected = false;
    this.setStatus('connecting', options.onStatusChange);

    return this.openSocket(options);
  }

  send(data: string | ArrayBuffer | ArrayBufferView): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.socket.send(data);
    return true;
  }

  beginPausedRetention(idleTimeoutMs?: number, onTimeout?: () => void): void {
    this.cancelPausedRetention();

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.startKeepAlive();
    if (idleTimeoutMs == null) {
      return;
    }
    this.pausedDisconnectTimer = setTimeout(() => {
      this.stopKeepAlive();
      if (onTimeout) {
        onTimeout();
        return;
      }

      this.disconnect();
    }, idleTimeoutMs);
  }

  cancelPausedRetention(): void {
    if (this.pausedDisconnectTimer) {
      clearTimeout(this.pausedDisconnectTimer);
      this.pausedDisconnectTimer = null;
    }
    this.stopKeepAlive();
  }

  canResumeWithoutReconnect(): boolean {
    return Boolean(this.socket) && this.socket?.readyState === WebSocket.OPEN;
  }

  getReadyState(): number | null {
    return this.socket?.readyState ?? null;
  }

  disconnect(options: StreamingWebSocketDisconnectOptions = {}): void {
    this.cancelPausedRetention();
    this.cancelReconnect();
    this.shouldStayDisconnected = true;
    this.currentConnectOptions = null;
    this.reconnectAttempts = 0;
    this.closeSocket(options.beforeClose);
    this.setStatus(options.nextStatus ?? 'idle');
  }

  get status(): StreamingConnectionStatus {
    return this.currentStatus;
  }

  setReconnectMaxAttempts(maxAttempts?: number): void {
    if (!this.currentConnectOptions?.reconnect) {
      return;
    }

    this.currentConnectOptions.reconnect.maxAttempts = maxAttempts;
  }

  private openSocket(
    options: StreamingWebSocketConnectOptions,
  ): Promise<void> {
    const socket = createSocket(options);
    this.socket = socket;

    return new Promise((resolve, reject) => {
      let isSettled = false;
      let hasOpened = false;

      const rejectConnection = (message: string) => {
        if (isSettled) {
          return;
        }
        isSettled = true;
        reject(new Error(message));
      };

      socket.onopen = () => {
        if (this.socket !== socket) {
          return;
        }

        hasOpened = true;
        isSettled = true;
        this.cancelReconnect();
        this.reconnectAttempts = 0;
        this.setStatus('open', options.onStatusChange);
        options.onOpen?.();
        resolve();
      };

      socket.onmessage = (event: MessageEvent) => {
        if (this.socket !== socket) {
          return;
        }

        void options.onMessage?.(event);
      };

      socket.onerror = (event: Event) => {
        if (this.socket !== socket) {
          return;
        }

        this.setStatus('error', options.onStatusChange);
        options.onError?.(event);

        if (!hasOpened) {
          rejectConnection(
            options.connectErrorMessage ?? 'Streaming WebSocket failed to connect',
          );
        }
      };

      socket.onclose = (event: CloseEvent) => {
        if (this.socket !== socket) {
          return;
        }

        this.socket = null;
        this.stopKeepAlive();
        this.setStatus('closed', options.onStatusChange);
        options.onClose?.(event);

        if (!hasOpened) {
          rejectConnection(
            options.closeBeforeOpenMessage?.(event) ??
              `Streaming WebSocket closed before ready (${event.code})`,
          );
        }

        if (this.shouldScheduleReconnect(options, event)) {
          this.scheduleReconnect(options);
        }
      };
    });
  }

  private shouldScheduleReconnect(
    options: StreamingWebSocketConnectOptions,
    event: CloseEvent | Event,
  ) {
    if (this.shouldStayDisconnected || !this.currentConnectOptions) {
      return false;
    }

    const reconnectOptions = options.reconnect;
    if (!reconnectOptions?.enabled) {
      return false;
    }

    if (reconnectOptions.shouldReconnect && !reconnectOptions.shouldReconnect(event)) {
      return false;
    }

    const maxAttempts = reconnectOptions.maxAttempts ?? Infinity;
    if (this.reconnectAttempts >= maxAttempts) {
      reconnectOptions.onReconnectExhausted?.(this.reconnectAttempts);
      return false;
    }

    return true;
  }

  private scheduleReconnect(options: StreamingWebSocketConnectOptions) {
    if (this.reconnectTimer) {
      return;
    }

    const reconnectOptions = options.reconnect;
    if (!reconnectOptions?.enabled) {
      return;
    }

    const delayMs = reconnectOptions.delayMs ?? 1_500;
    const attempt = this.reconnectAttempts + 1;
    this.reconnectAttempts = attempt;
    reconnectOptions.onReconnectScheduled?.(attempt, delayMs);
    this.setStatus('connecting', options.onStatusChange);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;

      if (this.shouldStayDisconnected || this.currentConnectOptions !== options) {
        return;
      }

      reconnectOptions.onReconnectAttempt?.(attempt);
      void this.openSocket(options)
        .then(() => {
          reconnectOptions.onReconnectSuccess?.(attempt);
        })
        .catch(() => {
          // Failed reconnect attempts continue through onclose scheduling.
        });
    }, delayMs);
  }

  private startKeepAlive() {
    const payload = this.currentConnectOptions?.keepAlive?.payload;
    if (!payload || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    if (this.keepAliveTimer) {
      return;
    }

    const intervalMs = this.currentConnectOptions?.keepAlive?.intervalMs ?? 8_000;
    this.keepAliveTimer = setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.stopKeepAlive();
        return;
      }

      const nextPayload =
        typeof payload === 'function' ? payload() : payload;
      this.socket.send(nextPayload);
    }, intervalMs);
  }

  private stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  private cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private closeSocket(beforeClose?: (socket: WebSocket) => void) {
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;

      beforeClose?.(socket);

      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    }
  }
}
