/**
 * VideoSyncPlugin - Hardened Video Synchronization Engine
 * Watch Party / Sferium-Homes Sync
 *
 * Provides sub-second timeline synchronization with latency compensation,
 * anti-drift correction, anti-jitter protection, and unified adapters
 * for HTML5 Video, YouTube, VK Video, Rutube, and generic iframe players.
 */

// ==========================================
// 1. Unified Player Interface & Adapters
// ==========================================

export interface UnifiedPlayer {
  play(): void | Promise<void>;
  pause(): void;
  seekTo(time: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  isPlaying?(): boolean;
}

export interface VideoSyncPayload {
  roomId: string;
  time: number;
  playing: boolean;
  rate: number;
  updatedAt: number;
  revision?: number;
  serverTime?: number;
}

export interface VideoSyncMessage {
  type: 'video:sync' | 'video:play' | 'video:pause' | 'video:seek' | string;
  roomId?: string;
  time?: number;
  currentTime?: number;
  playing?: boolean;
  isPlaying?: boolean;
  rate?: number;
  playbackRate?: number;
  updatedAt?: number;
  serverTime?: number;
  revision?: number;
  payload?: any;
}

export type WSConnection = WebSocket | {
  send: (data: string) => void;
  readyState?: number;
  addEventListener?: (event: string, handler: (e: any) => void) => void;
  removeEventListener?: (event: string, handler: (e: any) => void) => void;
  onmessage?: ((e: any) => void) | null;
  subscribe?: (handler: (msg: any) => void) => () => void;
};

/**
 * 1.1 HTML5 Video Player Adapter
 */
export class HTML5VideoPlayerAdapter implements UnifiedPlayer {
  private video: HTMLVideoElement;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  play(): Promise<void> | void {
    if (this.video) {
      const promise = this.video.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch((err) => {
          console.warn('[HTML5VideoPlayerAdapter] Autoplay restricted or play failed:', err);
        });
      }
    }
  }

  pause(): void {
    if (this.video && !this.video.paused) {
      this.video.pause();
    }
  }

  seekTo(time: number): void {
    if (this.video && !isNaN(time) && isFinite(time)) {
      this.video.currentTime = Math.max(0, time);
    }
  }

  getCurrentTime(): number {
    return this.video && !isNaN(this.video.currentTime) ? this.video.currentTime : 0;
  }

  getDuration(): number {
    return this.video && !isNaN(this.video.duration) ? this.video.duration : 0;
  }

  setPlaybackRate(rate: number): void {
    if (this.video && rate > 0) {
      this.video.playbackRate = rate;
    }
  }

  getPlaybackRate(): number {
    return this.video ? this.video.playbackRate || 1.0 : 1.0;
  }

  isPlaying(): boolean {
    return Boolean(this.video && !this.video.paused && !this.video.ended);
  }
}

/**
 * 1.2 YouTube Player Adapter
 */
export class YouTubePlayerAdapter implements UnifiedPlayer {
  private player: any;

  constructor(player: any) {
    this.player = player;
  }

  play(): void {
    if (!this.player) return;
    try {
      if (typeof this.player.playVideo === 'function') {
        this.player.playVideo();
      } else if (typeof this.player.play === 'function') {
        this.player.play();
      }
    } catch (e) {
      console.warn('[YouTubePlayerAdapter] play error:', e);
    }
  }

  pause(): void {
    if (!this.player) return;
    try {
      if (typeof this.player.pauseVideo === 'function') {
        this.player.pauseVideo();
      } else if (typeof this.player.pause === 'function') {
        this.player.pause();
      }
    } catch (e) {
      console.warn('[YouTubePlayerAdapter] pause error:', e);
    }
  }

  seekTo(time: number): void {
    if (!this.player || isNaN(time)) return;
    try {
      if (typeof this.player.seekTo === 'function') {
        this.player.seekTo(time, true);
      }
    } catch (e) {
      console.warn('[YouTubePlayerAdapter] seekTo error:', e);
    }
  }

  getCurrentTime(): number {
    if (!this.player) return 0;
    try {
      if (typeof this.player.getCurrentTime === 'function') {
        return this.player.getCurrentTime() || 0;
      }
    } catch {}
    return 0;
  }

  getDuration(): number {
    if (!this.player) return 0;
    try {
      if (typeof this.player.getDuration === 'function') {
        return this.player.getDuration() || 0;
      }
    } catch {}
    return 0;
  }

  setPlaybackRate(rate: number): void {
    if (!this.player || rate <= 0) return;
    try {
      if (typeof this.player.setPlaybackRate === 'function') {
        this.player.setPlaybackRate(rate);
      }
    } catch {}
  }

  getPlaybackRate(): number {
    if (!this.player) return 1.0;
    try {
      if (typeof this.player.getPlaybackRate === 'function') {
        return this.player.getPlaybackRate() || 1.0;
      }
    } catch {}
    return 1.0;
  }

  isPlaying(): boolean {
    if (!this.player) return false;
    try {
      if (typeof this.player.getPlayerState === 'function') {
        return this.player.getPlayerState() === 1; // 1 = YT.PlayerState.PLAYING
      }
      if (typeof this.player.isPlaying === 'function') {
        return Boolean(this.player.isPlaying());
      }
      if (typeof this.player.isPlaying === 'boolean') {
        return this.player.isPlaying;
      }
    } catch {}
    return false;
  }
}

/**
 * 1.3 VK Video Player Adapter
 */
export class VKVideoPlayerAdapter implements UnifiedPlayer {
  private player: any;
  private localRate: number = 1.0;

  constructor(player: any) {
    this.player = player;
  }

  play(): void {
    if (!this.player) return;
    try {
      if (typeof this.player.play === 'function') {
        this.player.play();
      } else if (typeof this.player.playVideo === 'function') {
        this.player.playVideo();
      }
    } catch (e) {
      console.warn('[VKVideoPlayerAdapter] play error:', e);
    }
  }

  pause(): void {
    if (!this.player) return;
    try {
      if (typeof this.player.pause === 'function') {
        this.player.pause();
      } else if (typeof this.player.pauseVideo === 'function') {
        this.player.pauseVideo();
      }
    } catch (e) {
      console.warn('[VKVideoPlayerAdapter] pause error:', e);
    }
  }

  seekTo(time: number): void {
    if (!this.player || isNaN(time)) return;
    try {
      if (typeof this.player.seekTo === 'function') {
        this.player.seekTo(time);
      } else if (typeof this.player.seek === 'function') {
        this.player.seek(time);
      }
    } catch (e) {
      console.warn('[VKVideoPlayerAdapter] seekTo error:', e);
    }
  }

  getCurrentTime(): number {
    if (!this.player) return 0;
    try {
      if (typeof this.player.getCurrentTime === 'function') {
        return this.player.getCurrentTime() || 0;
      }
      if (typeof this.player.currentTime === 'number') {
        return this.player.currentTime;
      }
    } catch {}
    return 0;
  }

  getDuration(): number {
    if (!this.player) return 0;
    try {
      if (typeof this.player.getDuration === 'function') {
        return this.player.getDuration() || 0;
      }
      if (typeof this.player.duration === 'number') {
        return this.player.duration;
      }
    } catch {}
    return 0;
  }

  setPlaybackRate(rate: number): void {
    this.localRate = rate;
    if (!this.player || rate <= 0) return;
    try {
      if (typeof this.player.setPlaybackRate === 'function') {
        this.player.setPlaybackRate(rate);
      }
    } catch {}
  }

  getPlaybackRate(): number {
    if (!this.player) return this.localRate;
    try {
      if (typeof this.player.getPlaybackRate === 'function') {
        return this.player.getPlaybackRate() || this.localRate;
      }
    } catch {}
    return this.localRate;
  }

  isPlaying(): boolean {
    if (!this.player) return false;
    try {
      if (typeof this.player.isPlaying === 'function') {
        return Boolean(this.player.isPlaying());
      }
      if (typeof this.player.isPlaying === 'boolean') {
        return this.player.isPlaying;
      }
    } catch {}
    return false;
  }
}

/**
 * 1.4 Generic / Universal Player Adapter (Rutube, Dzen, UniversalPlayer, etc.)
 */
export class GenericPlayerAdapter implements UnifiedPlayer {
  private player: any;
  private localRate: number = 1.0;

  constructor(player: any) {
    this.player = player;
  }

  play(): void {
    if (!this.player) return;
    try {
      if (typeof this.player.play === 'function') {
        this.player.play();
      } else if (typeof this.player.playVideo === 'function') {
        this.player.playVideo();
      }
    } catch (e) {
      console.warn('[GenericPlayerAdapter] play error:', e);
    }
  }

  pause(): void {
    if (!this.player) return;
    try {
      if (typeof this.player.pause === 'function') {
        this.player.pause();
      } else if (typeof this.player.pauseVideo === 'function') {
        this.player.pauseVideo();
      }
    } catch (e) {
      console.warn('[GenericPlayerAdapter] pause error:', e);
    }
  }

  seekTo(time: number): void {
    if (!this.player || isNaN(time)) return;
    try {
      if (typeof this.player.seekTo === 'function') {
        this.player.seekTo(time);
      } else if (typeof this.player.seek === 'function') {
        this.player.seek(time);
      } else if ('currentTime' in this.player) {
        this.player.currentTime = time;
      }
    } catch (e) {
      console.warn('[GenericPlayerAdapter] seekTo error:', e);
    }
  }

  getCurrentTime(): number {
    if (!this.player) return 0;
    try {
      if (typeof this.player.getCurrentTime === 'function') {
        return this.player.getCurrentTime() || 0;
      }
      if (typeof this.player.currentTime === 'number') {
        return this.player.currentTime;
      }
    } catch {}
    return 0;
  }

  getDuration(): number {
    if (!this.player) return 0;
    try {
      if (typeof this.player.getDuration === 'function') {
        return this.player.getDuration() || 0;
      }
      if (typeof this.player.duration === 'number') {
        return this.player.duration;
      }
    } catch {}
    return 0;
  }

  setPlaybackRate(rate: number): void {
    this.localRate = rate;
    if (!this.player || rate <= 0) return;
    try {
      if (typeof this.player.setPlaybackRate === 'function') {
        this.player.setPlaybackRate(rate);
      }
    } catch {}
  }

  getPlaybackRate(): number {
    if (!this.player) return this.localRate;
    try {
      if (typeof this.player.getPlaybackRate === 'function') {
        return this.player.getPlaybackRate() || this.localRate;
      }
    } catch {}
    return this.localRate;
  }

  isPlaying(): boolean {
    if (!this.player) return false;
    try {
      if (typeof this.player.isPlaying === 'function') {
        return Boolean(this.player.isPlaying());
      }
      if (typeof this.player.isPlaying === 'boolean') {
        return this.player.isPlaying;
      }
      if (typeof this.player.paused === 'boolean') {
        return !this.player.paused;
      }
    } catch {}
    return false;
  }
}

/**
 * Adapter factory helper to convert any player instance to UnifiedPlayer
 */
export function wrapAsUnifiedPlayer(player: any): UnifiedPlayer {
  if (!player) {
    return new GenericPlayerAdapter(null);
  }
  if (typeof player.play === 'function' && typeof player.pause === 'function' && typeof player.seekTo === 'function' && typeof player.getCurrentTime === 'function' && typeof player.setPlaybackRate === 'function') {
    return player as UnifiedPlayer;
  }
  if (player.tagName === 'VIDEO' || (typeof HTMLVideoElement !== 'undefined' && player instanceof HTMLVideoElement)) {
    return new HTML5VideoPlayerAdapter(player);
  }
  if (typeof player.playVideo === 'function' && typeof player.pauseVideo === 'function') {
    return new YouTubePlayerAdapter(player);
  }
  if (typeof player.sendVkCommand === 'function' || player.isVk) {
    return new VKVideoPlayerAdapter(player);
  }
  return new GenericPlayerAdapter(player);
}

// ==========================================
// 2. Anti-Drift & Network Latency Algorithm
// ==========================================

export interface ApplySyncResult {
  seeked: boolean;
  stateChanged: boolean;
  rateChanged: boolean;
  drift: number;
  correctedHostTime: number;
}

/**
 * applySync
 * Core anti-drift function with latency compensation and jitter protection.
 *
 * Rules:
 * 1. If Math.abs(playerTime - hostTime) > 0.3s -> perform seekTo(hostTime).
 * 2. If hostPlaying === true and playing === false -> call play().
 * 3. If hostPlaying === false and playing === true -> call pause().
 * 4. If hostRate !== rate -> call setPlaybackRate(hostRate).
 * 5. Protection against jitter:
 *    - No seekTo if drift <= 0.3s.
 *    - No redundant play/pause if state already matches.
 */
export function applySync(
  player: UnifiedPlayer,
  playerTime: number,
  hostTime: number,
  playing: boolean,
  hostPlaying: boolean,
  rate: number,
  hostRate: number,
  updatedAt?: number
): ApplySyncResult {
  let seeked = false;
  let stateChanged = false;
  let rateChanged = false;

  // 1. Calculate network latency compensation
  const now = Date.now();
  const latencyMs = updatedAt && updatedAt > 0 ? Math.max(0, now - updatedAt) : 0;
  const latencySeconds = latencyMs / 1000;

  // If host is playing, the video has progressed by (latency * hostRate) during transmission
  const effectiveHostRate = hostRate > 0 ? hostRate : 1.0;
  const correctedHostTime = hostPlaying
    ? hostTime + latencySeconds * effectiveHostRate
    : hostTime;

  const drift = Math.abs(playerTime - correctedHostTime);

  // 2. Strict 0.3s drift threshold
  if (drift > 0.3) {
    player.seekTo(correctedHostTime);
    seeked = true;
  }

  // 3. Synchronize play / pause states
  if (hostPlaying && !playing) {
    player.play();
    stateChanged = true;
  } else if (!hostPlaying && playing) {
    player.pause();
    stateChanged = true;
  }

  // 4. Synchronize playback rate
  const currentRate = rate > 0 ? rate : 1.0;
  if (Math.abs(effectiveHostRate - currentRate) > 0.01) {
    player.setPlaybackRate(effectiveHostRate);
    rateChanged = true;
  }

  return {
    seeked,
    stateChanged,
    rateChanged,
    drift,
    correctedHostTime,
  };
}

// ==========================================
// 3. VideoSyncPlugin Class
// ==========================================

export class VideoSyncPlugin {
  private player: UnifiedPlayer;
  private ws: any;
  public isHost: boolean;
  public roomId: string;

  private hostInterval: any = null;
  private guestInterval: any = null;
  private isRunning: boolean = false;
  private lastSeekCooldown: number = 0;

  public lastAppliedRevision: number = 0;
  public clockOffset: number = 0; // clientTime - serverTime
  public isApplyingRemoteUpdate: boolean = false;

  private lastHostState: {
    time: number;
    playing: boolean;
    rate: number;
    updatedAt: number;
    serverTime?: number;
    revision?: number;
  } = {
    time: 0,
    playing: false,
    rate: 1.0,
    updatedAt: Date.now(),
  };

  private boundMessageHandler: ((e: any) => void) | null = null;
  private unsubscribeFn: (() => void) | null = null;

  constructor(
    player: UnifiedPlayer | any,
    ws: any,
    isHost: boolean,
    roomId: string
  ) {
    this.player = wrapAsUnifiedPlayer(player);
    this.ws = ws;
    this.isHost = isHost;
    this.roomId = roomId;
  }

  /**
   * Calculates current estimated server time based on measured clock offset
   */
  public calculateServerNow(): number {
    return Date.now() - this.clockOffset;
  }

  /**
   * Computes estimated server playback position
   */
  public calculateEstimatedServerPosition(): number {
    if (!this.lastHostState.playing) {
      return this.lastHostState.time;
    }
    const currentServerTime = this.calculateServerNow();
    const baseServerTime = this.lastHostState.serverTime || this.lastHostState.updatedAt || currentServerTime;
    const elapsedSeconds = Math.max(0, (currentServerTime - baseServerTime) / 1000);
    const rate = this.lastHostState.rate > 0 ? this.lastHostState.rate : 1.0;
    return this.lastHostState.time + elapsedSeconds * rate;
  }

  /**
   * Start synchronization engine
   */
  public start(): void {
    if (this.isRunning) {
      this.stop();
    }
    this.isRunning = true;

    this.setupWebSocketListeners();

    if (this.isHost) {
      this.startHostBroadcastLoop();
    } else {
      this.startGuestAlignmentLoop();
    }
  }

  /**
   * Stop synchronization engine and clean up all timers and listeners
   */
  public stop(): void {
    this.isRunning = false;

    if (this.hostInterval) {
      clearInterval(this.hostInterval);
      this.hostInterval = null;
    }

    if (this.guestInterval) {
      clearInterval(this.guestInterval);
      this.guestInterval = null;
    }

    this.removeWebSocketListeners();
  }

  /**
   * Update host status dynamically (e.g. host role transfer)
   */
  public updateHostStatus(isHost: boolean): void {
    if (this.isHost === isHost) return;
    this.isHost = isHost;

    if (this.isRunning) {
      if (this.hostInterval) {
        clearInterval(this.hostInterval);
        this.hostInterval = null;
      }
      if (this.guestInterval) {
        clearInterval(this.guestInterval);
        this.guestInterval = null;
      }

      if (this.isHost) {
        this.startHostBroadcastLoop();
      } else {
        this.startGuestAlignmentLoop();
      }
    }
  }

  /**
   * Update Room ID
   */
  public updateRoomId(roomId: string): void {
    this.roomId = roomId;
  }

  /**
   * Update Player instance (e.g., when user switches video provider)
   */
  public updatePlayer(player: any): void {
    this.player = wrapAsUnifiedPlayer(player);
  }

  /**
   * Update WebSocket connection
   */
  public updateWebSocket(ws: any): void {
    this.removeWebSocketListeners();
    this.ws = ws;
    if (this.isRunning) {
      this.setupWebSocketListeners();
    }
  }

  // ----------------------------------------------------
  // Host Actions
  // ----------------------------------------------------

  /**
   * 3.1 Host Broadcast Loop (Every 500 ms)
   */
  private startHostBroadcastLoop(): void {
    if (this.hostInterval) clearInterval(this.hostInterval);

    this.hostInterval = setInterval(() => {
      if (!this.isHost || !this.isRunning) return;

      const currentTime = this.player.getCurrentTime();
      const isPlaying = typeof this.player.isPlaying === 'function' ? this.player.isPlaying() : false;
      const rate = this.player.getPlaybackRate() || 1.0;
      const now = Date.now();

      const payload: VideoSyncPayload = {
        roomId: this.roomId,
        time: currentTime,
        playing: isPlaying,
        rate: rate,
        updatedAt: now,
        serverTime: now,
      };

      this.sendWsMessage({
        type: 'video:sync',
        ...payload,
      });
    }, 500);
  }

  /**
   * Host triggers play
   */
  public notifyPlay(): void {
    if (!this.isHost) return;
    const time = this.player.getCurrentTime();
    const rate = this.player.getPlaybackRate() || 1.0;
    const now = Date.now();

    this.sendWsMessage({
      type: 'video:play',
      roomId: this.roomId,
      time,
      playing: true,
      rate,
      updatedAt: now,
      serverTime: now,
    });
  }

  /**
   * Host triggers pause
   */
  public notifyPause(): void {
    if (!this.isHost) return;
    const time = this.player.getCurrentTime();
    const rate = this.player.getPlaybackRate() || 1.0;
    const now = Date.now();

    this.sendWsMessage({
      type: 'video:pause',
      roomId: this.roomId,
      time,
      playing: false,
      rate,
      updatedAt: now,
      serverTime: now,
    });
  }

  /**
   * Host triggers seek
   */
  public notifySeek(time: number): void {
    if (!this.isHost) return;
    const isPlaying = typeof this.player.isPlaying === 'function' ? this.player.isPlaying() : false;
    const rate = this.player.getPlaybackRate() || 1.0;
    const now = Date.now();

    this.sendWsMessage({
      type: 'video:seek',
      roomId: this.roomId,
      time,
      playing: isPlaying,
      rate,
      updatedAt: now,
      serverTime: now,
    });
  }

  // ----------------------------------------------------
  // Guest Alignment
  // ----------------------------------------------------

  /**
   * 3.2 Guest Periodic Alignment Loop (Every 750–1000 ms)
   */
  private startGuestAlignmentLoop(): void {
    if (this.guestInterval) clearInterval(this.guestInterval);

    this.guestInterval = setInterval(() => {
      if (this.isHost || !this.isRunning) return;
      this.alignGuestWithHost();
    }, 800);
  }

  /**
   * Performs comparison with latest Host/Server state
   */
  public alignGuestWithHost(): ApplySyncResult | null {
    if (!this.player) return null;

    const now = Date.now();
    // Anti-jitter: Avoid consecutive seeks within 400ms cooldown window
    if (now - this.lastSeekCooldown < 400) {
      return null;
    }

    const localTime = this.player.getCurrentTime();
    const localPlaying = typeof this.player.isPlaying === 'function' ? this.player.isPlaying() : false;
    const localRate = this.player.getPlaybackRate() || 1.0;

    const estimatedServerPosition = this.calculateEstimatedServerPosition();
    const drift = Math.abs(localTime - estimatedServerPosition);

    let seeked = false;
    let stateChanged = false;
    let rateChanged = false;

    this.isApplyingRemoteUpdate = true;
    try {
      // 1. Hard seek if drift > 0.4s
      if (drift > 0.4) {
        this.player.seekTo(estimatedServerPosition);
        seeked = true;
        this.lastSeekCooldown = now;
      }

      // 2. Sync play/pause state
      if (this.lastHostState.playing && !localPlaying) {
        this.player.play();
        stateChanged = true;
      } else if (!this.lastHostState.playing && localPlaying) {
        this.player.pause();
        stateChanged = true;
      }

      // 3. Sync rate
      const targetRate = this.lastHostState.rate > 0 ? this.lastHostState.rate : 1.0;
      if (Math.abs(targetRate - localRate) > 0.01) {
        this.player.setPlaybackRate(targetRate);
        rateChanged = true;
      }
    } finally {
      setTimeout(() => {
        this.isApplyingRemoteUpdate = false;
      }, 50);
    }

    return {
      seeked,
      stateChanged,
      rateChanged,
      drift,
      correctedHostTime: estimatedServerPosition,
    };
  }

  // ----------------------------------------------------
  // WebSocket Message Handling
  // ----------------------------------------------------

  private setupWebSocketListeners(): void {
    if (!this.ws) return;

    this.boundMessageHandler = (event: any) => {
      try {
        let raw = event.data !== undefined ? event.data : event;
        if (typeof raw === 'string') {
          raw = JSON.parse(raw);
        }
        this.handleIncomingMessage(raw);
      } catch (err) {
        // Non-JSON or benign event
      }
    };

    if (typeof this.ws.addEventListener === 'function') {
      this.ws.addEventListener('message', this.boundMessageHandler);
    } else if (typeof this.ws.subscribe === 'function') {
      this.unsubscribeFn = this.ws.subscribe((msg: any) => this.handleIncomingMessage(msg));
    } else if (this.ws.onmessage !== undefined) {
      const prevOnMessage = this.ws.onmessage;
      this.ws.onmessage = (e: any) => {
        if (prevOnMessage) prevOnMessage(e);
        if (this.boundMessageHandler) this.boundMessageHandler(e);
      };
    }
  }

  private removeWebSocketListeners(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
    if (this.ws && this.boundMessageHandler) {
      if (typeof this.ws.removeEventListener === 'function') {
        this.ws.removeEventListener('message', this.boundMessageHandler);
      }
      this.boundMessageHandler = null;
    }
  }

  /**
   * Handle incoming sync messages
   */
  public handleIncomingMessage(msg: VideoSyncMessage): void {
    if (!msg || typeof msg !== 'object') return;

    // Filter by roomId if present
    if (msg.roomId && this.roomId && msg.roomId !== this.roomId) {
      return;
    }

    // Monotonic Revision Guard: reject stale / out-of-order revisions
    if (typeof msg.revision === 'number' && msg.revision > 0) {
      if (msg.revision <= this.lastAppliedRevision) {
        return; // Stale message rejected
      }
      this.lastAppliedRevision = msg.revision;
    }

    // Clock offset estimation from server timestamp
    if (typeof msg.serverTime === 'number' && msg.serverTime > 0) {
      this.clockOffset = Date.now() - msg.serverTime;
    }

    const type = msg.type;

    // Normalizing sync message types
    const isSyncEvent = type === 'video:sync' || type === 'sync:state' || type === 'video_sync' || type === 'player:heartbeat';
    const isPlayEvent = type === 'video:play' || type === 'sync:play' || type === 'play_video' || type === 'sync_play';
    const isPauseEvent = type === 'video:pause' || type === 'sync:pause' || type === 'pause_video' || type === 'sync_pause';
    const isSeekEvent = type === 'video:seek' || type === 'sync:seek' || type === 'seek_video' || type === 'sync_seek' || type === 'player:seek';

    if (!isSyncEvent && !isPlayEvent && !isPauseEvent && !isSeekEvent && type !== 'player:state' && type !== 'room_state') {
      return;
    }

    // Extract time
    let time = 0;
    if (typeof msg.time === 'number') time = msg.time;
    else if (typeof msg.currentTime === 'number') time = msg.currentTime;
    else if (msg.payload && typeof msg.payload.time === 'number') time = msg.payload.time;
    else if (typeof msg.time === 'string') time = parseFloat(msg.time) || 0;
    else if (typeof msg.currentTime === 'string') time = parseFloat(msg.currentTime) || 0;

    // Extract playing
    let playing = this.lastHostState.playing;
    if (typeof msg.playing === 'boolean') playing = msg.playing;
    else if (typeof msg.isPlaying === 'boolean') playing = msg.isPlaying;
    else if (msg.payload && typeof msg.payload.playing === 'boolean') playing = msg.payload.playing;
    else if (isPlayEvent) playing = true;
    else if (isPauseEvent) playing = false;

    // Extract rate
    let rate = 1.0;
    if (typeof msg.rate === 'number' && msg.rate > 0) rate = msg.rate;
    else if (typeof msg.playbackRate === 'number' && msg.playbackRate > 0) rate = msg.playbackRate;
    else if (this.lastHostState.rate > 0) rate = this.lastHostState.rate;

    // Extract timestamp
    const updatedAt = (typeof msg.updatedAt === 'number' && msg.updatedAt > 0)
      ? msg.updatedAt
      : (msg.payload?.ts || Date.now());

    this.lastHostState = {
      time,
      playing,
      rate,
      updatedAt,
      serverTime: msg.serverTime || updatedAt,
      revision: msg.revision,
    };

    // If we are a guest, react immediately to event-driven updates
    if (!this.isHost) {
      this.isApplyingRemoteUpdate = true;
      try {
        if (isPlayEvent) {
          this.lastHostState.playing = true;
          this.player.play();
          if (time > 0) {
            const localTime = this.player.getCurrentTime();
            if (Math.abs(localTime - time) > 0.3) {
              this.player.seekTo(time);
            }
          }
        } else if (isPauseEvent) {
          this.lastHostState.playing = false;
          this.player.pause();
          if (time > 0) {
            this.player.seekTo(time);
          }
        } else if (isSeekEvent) {
          this.player.seekTo(time);
          this.lastSeekCooldown = Date.now();
          if (playing) {
            this.player.play();
          } else {
            this.player.pause();
          }
        } else {
          // Periodic sync event -> apply anti-drift
          this.alignGuestWithHost();
        }
      } finally {
        setTimeout(() => {
          this.isApplyingRemoteUpdate = false;
        }, 50);
      }
    }
  }

  /**
   * Helper to send JSON messages through WebSocket
   */
  private sendWsMessage(obj: any): void {
    if (!this.ws) return;
    try {
      const dataStr = JSON.stringify(obj);
      if (typeof this.ws.send === 'function') {
        if (this.ws.readyState === undefined || this.ws.readyState === 1 /* OPEN */) {
          this.ws.send(dataStr);
        }
      }
    } catch (e) {
      console.warn('[VideoSyncPlugin] sendWsMessage failed:', e);
    }
  }

  public getLastHostState() {
    return { ...this.lastHostState };
  }
}

export default VideoSyncPlugin;
