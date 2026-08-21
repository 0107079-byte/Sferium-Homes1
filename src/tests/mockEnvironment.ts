/**
 * Autonomous Mock Environment for Watch Party Auto-Tests
 * Operates completely in-memory without contacting real external backend servers or altering real UI.
 */

export interface MockWSMessageEvent {
  data: string;
}

export interface MockWebSocket {
  readyState: number;
  send: (data: string) => void;
  addEventListener: (event: string, handler: (e: MockWSMessageEvent) => void) => void;
  removeEventListener: (event: string, handler: (e: MockWSMessageEvent) => void) => void;
  triggerMessage: (data: any) => void;
}

export function createMockWebSocketPair() {
  const hostListeners = new Set<(e: MockWSMessageEvent) => void>();
  const guestListeners = new Set<(e: MockWSMessageEvent) => void>();

  let serverMessageHandler: ((msg: any, isHost: boolean) => void) | null = null;

  const hostWS: MockWebSocket = {
    readyState: 1, // OPEN
    addEventListener: (event, handler) => {
      if (event === 'message') hostListeners.add(handler);
    },
    removeEventListener: (event, handler) => {
      if (event === 'message') hostListeners.delete(handler);
    },
    send: (dataStr: string) => {
      try {
        const msg = JSON.parse(dataStr);
        if (serverMessageHandler) {
          serverMessageHandler(msg, true);
        }
      } catch (e) {
        console.error('hostWS send error:', e);
      }
    },
    triggerMessage: (data: any) => {
      const event: MockWSMessageEvent = {
        data: typeof data === 'string' ? data : JSON.stringify(data),
      };
      hostListeners.forEach((fn) => fn(event));
    },
  };

  const guestWS: MockWebSocket = {
    readyState: 1,
    addEventListener: (event, handler) => {
      if (event === 'message') guestListeners.add(handler);
    },
    removeEventListener: (event, handler) => {
      if (event === 'message') guestListeners.delete(handler);
    },
    send: (dataStr: string) => {
      try {
        const msg = JSON.parse(dataStr);
        if (serverMessageHandler) {
          serverMessageHandler(msg, false);
        }
      } catch (e) {
        console.error('guestWS send error:', e);
      }
    },
    triggerMessage: (data: any) => {
      const event: MockWSMessageEvent = {
        data: typeof data === 'string' ? data : JSON.stringify(data),
      };
      guestListeners.forEach((fn) => fn(event));
    },
  };

  const broadcast = (data: any) => {
    hostWS.triggerMessage(data);
    guestWS.triggerMessage(data);
  };

  return {
    hostWS,
    guestWS,
    broadcast,
    setServerHandler: (handler: (msg: any, isHost: boolean) => void) => {
      serverMessageHandler = handler;
    },
  };
}

export function createMockVideoElement() {
  let _currentTime = 0;
  let _paused = true;

  return {
    get currentTime() {
      return _currentTime;
    },
    set currentTime(val: number) {
      _currentTime = Number(val);
    },
    get paused() {
      return _paused;
    },
    play: async () => {
      _paused = false;
      return Promise.resolve();
    },
    pause: () => {
      _paused = true;
    },
  };
}

export function createMockYouTubePlayer() {
  let _currentTime = 0;
  let _isPlaying = false;

  return {
    playVideo: () => {
      _isPlaying = true;
    },
    pauseVideo: () => {
      _isPlaying = false;
    },
    seekTo: (seconds: number) => {
      _currentTime = seconds;
    },
    getCurrentTime: () => _currentTime,
    getPlayerState: () => (_isPlaying ? 1 : 2),
    get isPlaying() {
      return _isPlaying;
    },
  };
}

export function createMockVKPlayer() {
  let _currentTime = 0;
  let _isPlaying = false;

  return {
    play: () => {
      _isPlaying = true;
    },
    pause: () => {
      _isPlaying = false;
    },
    seekTo: (seconds: number) => {
      _currentTime = seconds;
    },
    getCurrentTime: () => _currentTime,
    get isPlaying() {
      return _isPlaying;
    },
  };
}

export function createMockRutubePlayer() {
  let _currentTime = 0;
  let _isPlaying = false;

  return {
    play: () => {
      _isPlaying = true;
    },
    pause: () => {
      _isPlaying = false;
    },
    seekTo: (seconds: number) => {
      _currentTime = seconds;
    },
    getCurrentTime: () => _currentTime,
    get isPlaying() {
      return _isPlaying;
    },
  };
}

export function createMockLiveKitRoom() {
  const listeners = new Map<string, Set<Function>>();
  const participants = new Map<string, any>();

  return {
    on: (event: string, fn: Function) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    },
    emit: (event: string, ...args: any[]) => {
      listeners.get(event)?.forEach((fn) => fn(...args));
    },
    connect: async (url: string, token: string) => {
      return Promise.resolve(true);
    },
    disconnect: () => {},
    participants,
  };
}

export function createMockPeerConnection() {
  const listeners = new Map<string, Set<Function>>();
  let _open = true;

  return {
    get open() {
      return _open;
    },
    on: (event: string, fn: Function) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    },
    send: (data: any) => {},
    close: () => {
      _open = false;
    },
  };
}
