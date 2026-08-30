/**
 * SyncController & Unified Player Adapters
 * Watch Party / Sferium-Homes Authoritative Video Synchronization Engine
 *
 * Provides:
 * 1. Single Authoritative SyncController (Host authoritative timeline, Server relay, Guest slave)
 * 2. 3-Zone Drift Correction (Zone 1: Deadband <80ms, Zone 2: Soft Rate Correction 80-350ms, Zone 3: Hard Seek >=350ms)
 * 3. Monotonic Revision Guard (Rejection of out-of-order & stale packets)
 * 4. Unified Player Adapters (HTML5, YouTube, VK Video, Rutube, Yandex/Generic)
 * 5. Strict Latency Compensation and Clock Skew Offset Estimation
 * 6. Single Lifecycle-managed Heartbeat & Alignment Loops
 */

// ==========================================
// 1. Interfaces & Types
// ==========================================

export interface PlayerAdapter {
  play(): Promise<void> | void;
  pause(): void;
  seekTo(time: number): Promise<void> | void;
  getCurrentTime(): number;
  getDuration(): number;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  isPlaying(): boolean;
  isReady?(): boolean;
  destroy?(): void;
}

// Backward-compatible alias
export type UnifiedPlayer = PlayerAdapter;

export interface SyncState {
  roomId: string;
  revision: number;
  position: number;
  playing: boolean;
  playbackRate: number;
  updatedAt: number;
  serverTime: number;
  senderId?: string;
}

export interface SyncCommand {
  type: 'SYNC_COMMAND';
  command: 'play' | 'pause' | 'seek' | 'rate';
  roomId: string;
  position?: number;
  playing?: boolean;
  playbackRate?: number;
  revision?: number;
  updatedAt?: number;
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
  type: string;
  roomId?: string;
  time?: number;
  currentTime?: number;
  position?: number;
  playing?: boolean;
  isPlaying?: boolean;
  rate?: number;
  playbackRate?: number;
  updatedAt?: number;
  serverTime?: number;
  revision?: number;
  senderId?: string;
  command?: 'play' | 'pause' | 'seek' | 'rate';
  payload?: any;
}

export interface DriftCorrectionConfig {
  deadbandSeconds: number;       // Zone 1/2 boundary: >= 80ms enters soft rate correction
  deadbandExitSeconds: number;   // Zone 2 exit hysteresis: < 40ms exits soft rate correction
  softThresholdSeconds: number;  // Zone 2/3 boundary: >= 350ms triggers hard seek
  hardSeekThresholdSeconds: number; // Zone 3 threshold (350ms)
  softSpeedupRate: number;       // 1.05
  softSlowdownRate: number;      // 0.95
  seekCooldownMs: number;        // Cooldown between hard seeks (400ms)
  enableTelemetry?: boolean;     // Development telemetry
}

export const DEFAULT_DRIFT_CONFIG: DriftCorrectionConfig = {
  deadbandSeconds: 0.08,         // 80 ms
  deadbandExitSeconds: 0.04,     // 40 ms (Hysteresis exit threshold)
  softThresholdSeconds: 0.35,     // 350 ms
  hardSeekThresholdSeconds: 0.35, // 350 ms
  softSpeedupRate: 1.05,
  softSlowdownRate: 0.95,
  seekCooldownMs: 400,
  enableTelemetry: false,
};

export type WSConnection = WebSocket | {
  send: (data: string) => void;
  readyState?: number;
  addEventListener?: (event: string, handler: (e: any) => void) => void;
  removeEventListener?: (event: string, handler: (e: any) => void) => void;
  onmessage?: ((e: any) => void) | null;
  subscribe?: (handler: (msg: any) => void) => () => void;
};

// ==========================================
// 2. Unified Player Adapters
// ==========================================

/**
 * 2.1 HTML5 Video Player Adapter
 */
export class HTML5VideoPlayerAdapter implements PlayerAdapter {
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
    if (this.video && rate > 0 && isFinite(rate)) {
      this.video.playbackRate = rate;
    }
  }

  getPlaybackRate(): number {
    return this.video ? this.video.playbackRate || 1.0 : 1.0;
  }

  isPlaying(): boolean {
    return Boolean(this.video && !this.video.paused && !this.video.ended);
  }

  isReady(): boolean {
    return Boolean(this.video && this.video.readyState >= 1);
  }

  destroy(): void {}
}

/**
 * 2.2 YouTube Player Adapter
 */
export class YouTubePlayerAdapter implements PlayerAdapter {
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

  isReady(): boolean {
    return Boolean(this.player && typeof this.player.getCurrentTime === 'function');
  }

  destroy(): void {}
}

/**
 * 2.3 VK Video Player Adapter
 */
export class VKVideoPlayerAdapter implements PlayerAdapter {
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

  isReady(): boolean {
    return Boolean(this.player);
  }

  destroy(): void {}
}

/**
 * 2.4 Rutube Player Adapter
 */
export class RutubePlayerAdapter implements PlayerAdapter {
  private player: any;
  private localRate: number = 1.0;

  constructor(player: any) {
    this.player = player;
  }

  play(): void {
    if (!this.player) return;
    try {
      if (typeof this.player.play === 'function') this.player.play();
    } catch (e) {
      console.warn('[RutubePlayerAdapter] play error:', e);
    }
  }

  pause(): void {
    if (!this.player) return;
    try {
      if (typeof this.player.pause === 'function') this.player.pause();
    } catch (e) {
      console.warn('[RutubePlayerAdapter] pause error:', e);
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
      console.warn('[RutubePlayerAdapter] seekTo error:', e);
    }
  }

  getCurrentTime(): number {
    if (!this.player) return 0;
    try {
      if (typeof this.player.getCurrentTime === 'function') return this.player.getCurrentTime() || 0;
    } catch {}
    return 0;
  }

  getDuration(): number {
    if (!this.player) return 0;
    try {
      if (typeof this.player.getDuration === 'function') return this.player.getDuration() || 0;
    } catch {}
    return 0;
  }

  setPlaybackRate(rate: number): void {
    this.localRate = rate;
    if (!this.player || rate <= 0) return;
    try {
      if (typeof this.player.setPlaybackRate === 'function') this.player.setPlaybackRate(rate);
    } catch {}
  }

  getPlaybackRate(): number {
    return this.localRate;
  }

  isPlaying(): boolean {
    if (!this.player) return false;
    try {
      if (typeof this.player.isPlaying === 'function') return Boolean(this.player.isPlaying());
    } catch {}
    return false;
  }

  isReady(): boolean {
    return Boolean(this.player);
  }

  destroy(): void {}
}

/**
 * 2.5 Generic / Universal Player Adapter (Yandex, Dzen, UniversalPlayer, etc.)
 */
export class GenericPlayerAdapter implements PlayerAdapter {
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

  isReady(): boolean {
    return Boolean(this.player);
  }

  destroy(): void {}
}

/**
 * Adapter factory helper to convert any player instance to PlayerAdapter
 */
export function wrapAsUnifiedPlayer(player: any): PlayerAdapter {
  if (!player) {
    return new GenericPlayerAdapter(null);
  }
  if (
    typeof player.play === 'function' &&
    typeof player.pause === 'function' &&
    typeof player.seekTo === 'function' &&
    typeof player.getCurrentTime === 'function' &&
    typeof player.setPlaybackRate === 'function'
  ) {
    return player as PlayerAdapter;
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
// 3. Mathematical 3-Zone Drift Correction
// ==========================================

export interface ApplySyncResult {
  seeked: boolean;
  stateChanged: boolean;
  rateChanged: boolean;
  drift: number;
  correctedHostTime: number;
  appliedRate: number;
}

/**
 * applySync
 * 3-Zone Anti-Drift Engine:
 * - Zone 1: |drift| < deadband (80ms) -> No seek, rate = authoritative rate
 * - Zone 2: deadband <= |drift| < hardSeekThreshold (80ms..350ms) -> Smooth playbackRate correction (0.95 or 1.05)
 * - Zone 3: |drift| >= hardSeekThreshold (>= 350ms) -> Single hard seekTo(correctedHostTime)
 */
export function applySync(
  player: PlayerAdapter,
  playerTime: number,
  hostTime: number,
  playing: boolean,
  hostPlaying: boolean,
  rate: number,
  hostRate: number,
  updatedAt?: number,
  config: DriftCorrectionConfig = DEFAULT_DRIFT_CONFIG
): ApplySyncResult {
  let seeked = false;
  let stateChanged = false;
  let rateChanged = false;

  // 1. Calculate network latency compensation
  const now = Date.now();
  const latencyMs = updatedAt && updatedAt > 0 ? Math.max(0, now - updatedAt) : 0;
  const latencySeconds = latencyMs / 1000;

  // If host is playing, video advanced by (latency * hostRate) during network transit
  const effectiveHostRate = hostRate > 0 ? hostRate : 1.0;
  const correctedHostTime = hostPlaying
    ? hostTime + latencySeconds * effectiveHostRate
    : hostTime;

  const rawDiff = playerTime - correctedHostTime; // positive: guest is ahead, negative: guest is behind
  const drift = Math.abs(rawDiff);

  let targetRate = effectiveHostRate;

  // 2. Three-Zone Drift Strategy
  if (drift >= config.hardSeekThresholdSeconds) {
    // ZONE 3: Hard Seek
    player.seekTo(correctedHostTime);
    seeked = true;
    targetRate = effectiveHostRate;
  } else if (drift >= config.deadbandSeconds && hostPlaying) {
    // ZONE 2: Soft Rate Correction
    if (rawDiff > 0) {
      // Guest is ahead of host -> slow down smoothly
      targetRate = effectiveHostRate * config.softSlowdownRate;
    } else {
      // Guest is behind host -> speed up smoothly
      targetRate = effectiveHostRate * config.softSpeedupRate;
    }
  } else {
    // ZONE 1: Deadband -> perfect sync, match host rate
    targetRate = effectiveHostRate;
  }

  // 3. Apply playback rate if changed
  const currentRate = rate > 0 ? rate : 1.0;
  if (Math.abs(targetRate - currentRate) > 0.01) {
    player.setPlaybackRate(targetRate);
    rateChanged = true;
  }

  // 4. Synchronize play / pause states
  if (hostPlaying && !playing) {
    player.play();
    stateChanged = true;
  } else if (!hostPlaying && playing) {
    player.pause();
    stateChanged = true;
  }

  return {
    seeked,
    stateChanged,
    rateChanged,
    drift,
    correctedHostTime,
    appliedRate: targetRate,
  };
}

// ==========================================
// 4. Authoritative SyncController Class
// ==========================================

export class SyncController {
  private player: PlayerAdapter;
  private ws: any;
  public isHost: boolean;
  public roomId: string;
  public config: DriftCorrectionConfig;

  private hostInterval: any = null;
  private guestInterval: any = null;
  private isRunning: boolean = false;
  private lastSeekCooldown: number = 0;
  private isSoftCorrecting: boolean = false;

  public lastAppliedRevision: number = 0;
  public clockOffset: number = 0; // clientTime - serverTime
  public isApplyingRemoteUpdate: boolean = false;

  private lastHostState: {
    time: number;
    playing: boolean;
    rate: number;
    updatedAt: number;
    serverTime: number;
    revision: number;
  } = {
    time: 0,
    playing: false,
    rate: 1.0,
    updatedAt: Date.now(),
    serverTime: Date.now(),
    revision: 0,
  };

  private boundMessageHandler: ((e: any) => void) | null = null;
  private unsubscribeFn: (() => void) | null = null;

  constructor(
    player: PlayerAdapter | any,
    ws: any,
    isHost: boolean,
    roomId: string,
    config: DriftCorrectionConfig = DEFAULT_DRIFT_CONFIG
  ) {
    this.player = wrapAsUnifiedPlayer(player);
    this.ws = ws;
    this.isHost = isHost;
    this.roomId = roomId;
    this.config = { ...DEFAULT_DRIFT_CONFIG, ...config };
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
      // On start / reconnect, immediately request latest state from server
      this.requestServerSync();
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

  public destroy(): void {
    this.stop();
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
        this.requestServerSync();
      }
    }
  }

  public updateRoomId(roomId: string): void {
    this.roomId = roomId;
  }

  public updatePlayer(player: any): void {
    this.player = wrapAsUnifiedPlayer(player);
  }

  public updateWebSocket(ws: any): void {
    this.removeWebSocketListeners();
    this.ws = ws;
    if (this.isRunning) {
      this.setupWebSocketListeners();
      if (!this.isHost) {
        this.requestServerSync();
      }
    }
  }

  // ----------------------------------------------------
  // Host Actions
  // ----------------------------------------------------

  /**
   * Host Broadcast Loop (Single 500 ms heartbeat loop)
   */
  private startHostBroadcastLoop(): void {
    if (this.hostInterval) clearInterval(this.hostInterval);

    this.hostInterval = setInterval(() => {
      if (!this.isHost || !this.isRunning) return;

      const currentTime = this.player.getCurrentTime();
      const isPlaying = typeof this.player.isPlaying === 'function' ? this.player.isPlaying() : false;
      const rate = this.player.getPlaybackRate() || 1.0;
      const now = Date.now();

      this.sendWsMessage({
        type: 'SYNC_STATE',
        roomId: this.roomId,
        position: currentTime,
        time: currentTime,
        playing: isPlaying,
        playbackRate: rate,
        rate: rate,
        updatedAt: now,
        serverTime: now,
      });

      // Backward compatible video:sync message
      this.sendWsMessage({
        type: 'video:sync',
        roomId: this.roomId,
        time: currentTime,
        playing: isPlaying,
        rate: rate,
        updatedAt: now,
        serverTime: now,
      });
    }, 500);
  }

  public notifyPlay(): void {
    if (!this.isHost) return;
    const time = this.player.getCurrentTime();
    const rate = this.player.getPlaybackRate() || 1.0;
    const now = Date.now();

    this.sendWsMessage({
      type: 'SYNC_COMMAND',
      command: 'play',
      roomId: this.roomId,
      position: time,
      time,
      playing: true,
      playbackRate: rate,
      rate,
      updatedAt: now,
    });

    this.sendWsMessage({
      type: 'video:play',
      roomId: this.roomId,
      time,
      playing: true,
      rate,
      updatedAt: now,
    });
  }

  public notifyPause(): void {
    if (!this.isHost) return;
    const time = this.player.getCurrentTime();
    const rate = this.player.getPlaybackRate() || 1.0;
    const now = Date.now();

    this.sendWsMessage({
      type: 'SYNC_COMMAND',
      command: 'pause',
      roomId: this.roomId,
      position: time,
      time,
      playing: false,
      playbackRate: rate,
      rate,
      updatedAt: now,
    });

    this.sendWsMessage({
      type: 'video:pause',
      roomId: this.roomId,
      time,
      playing: false,
      rate,
      updatedAt: now,
    });
  }

  public notifySeek(time: number): void {
    if (!this.isHost) return;
    const isPlaying = typeof this.player.isPlaying === 'function' ? this.player.isPlaying() : false;
    const rate = this.player.getPlaybackRate() || 1.0;
    const now = Date.now();

    this.sendWsMessage({
      type: 'SYNC_COMMAND',
      command: 'seek',
      roomId: this.roomId,
      position: time,
      time,
      playing: isPlaying,
      playbackRate: rate,
      rate,
      updatedAt: now,
    });

    this.sendWsMessage({
      type: 'video:seek',
      roomId: this.roomId,
      time,
      playing: isPlaying,
      rate,
      updatedAt: now,
    });
  }

  public notifyRate(rate: number): void {
    if (!this.isHost) return;
    const time = this.player.getCurrentTime();
    const isPlaying = typeof this.player.isPlaying === 'function' ? this.player.isPlaying() : false;
    const now = Date.now();

    this.sendWsMessage({
      type: 'SYNC_COMMAND',
      command: 'rate',
      roomId: this.roomId,
      position: time,
      time,
      playing: isPlaying,
      playbackRate: rate,
      rate,
      updatedAt: now,
    });
  }

  // ----------------------------------------------------
  // Guest Alignment Loop
  // ----------------------------------------------------

  private startGuestAlignmentLoop(): void {
    if (this.guestInterval) clearInterval(this.guestInterval);

    this.guestInterval = setInterval(() => {
      if (this.isHost || !this.isRunning) return;
      this.alignGuestWithHost();
    }, 700);
  }

  public requestServerSync(): void {
    this.sendWsMessage({
      type: 'SYNC_REQUEST',
      roomId: this.roomId,
    });
  }

  public alignGuestWithHost(): ApplySyncResult | null {
    if (!this.player) return null;

    const localTime = this.player.getCurrentTime();
    const localPlaying = typeof this.player.isPlaying === 'function' ? this.player.isPlaying() : false;
    const localRate = this.player.getPlaybackRate() || 1.0;

    const estimatedServerPosition = this.calculateEstimatedServerPosition();
    const rawDiff = localTime - estimatedServerPosition; // positive: local is ahead, negative: local is behind
    const drift = Math.abs(rawDiff);

    const now = Date.now();
    let seeked = false;
    let stateChanged = false;
    let rateChanged = false;
    let appliedRate = this.lastHostState.rate > 0 ? this.lastHostState.rate : 1.0;

    this.isApplyingRemoteUpdate = true;
    try {
      // 1. Play / Pause State Alignment
      if (this.lastHostState.playing && !localPlaying) {
        this.player.play();
        stateChanged = true;
      } else if (!this.lastHostState.playing && localPlaying) {
        this.player.pause();
        stateChanged = true;
      }

      // 2. Three-Zone Drift Strategy with Hysteresis
      if (drift >= this.config.hardSeekThresholdSeconds) {
        // ZONE 3: Hard Seek (Guarded by Cooldown to prevent seek storms)
        this.isSoftCorrecting = false;
        if (now - this.lastSeekCooldown >= this.config.seekCooldownMs) {
          this.player.seekTo(estimatedServerPosition);
          seeked = true;
          this.lastSeekCooldown = now;
          appliedRate = this.lastHostState.rate > 0 ? this.lastHostState.rate : 1.0;
          this.player.setPlaybackRate(appliedRate);
        }
      } else if (this.lastHostState.playing) {
        // Evaluate soft correction zone with hysteresis
        if (drift >= this.config.deadbandSeconds) {
          this.isSoftCorrecting = true;
        } else if (drift < this.config.deadbandExitSeconds) {
          this.isSoftCorrecting = false;
        }

        if (this.isSoftCorrecting) {
          // ZONE 2: Soft Rate Correction relative to authoritative host rate
          const hostBaseRate = this.lastHostState.rate > 0 ? this.lastHostState.rate : 1.0;
          if (rawDiff > 0) {
            // Guest is ahead -> slow down
            appliedRate = hostBaseRate * this.config.softSlowdownRate;
          } else {
            // Guest is behind -> speed up
            appliedRate = hostBaseRate * this.config.softSpeedupRate;
          }
          if (Math.abs(appliedRate - localRate) > 0.01) {
            this.player.setPlaybackRate(appliedRate);
            rateChanged = true;
          }
        } else {
          // ZONE 1: Deadband -> match host rate
          appliedRate = this.lastHostState.rate > 0 ? this.lastHostState.rate : 1.0;
          if (Math.abs(appliedRate - localRate) > 0.01) {
            this.player.setPlaybackRate(appliedRate);
            rateChanged = true;
          }
        }
      } else {
        // Host paused -> maintain host base rate
        this.isSoftCorrecting = false;
        appliedRate = this.lastHostState.rate > 0 ? this.lastHostState.rate : 1.0;
        if (Math.abs(appliedRate - localRate) > 0.01) {
          this.player.setPlaybackRate(appliedRate);
          rateChanged = true;
        }
      }
    } finally {
      setTimeout(() => {
        this.isApplyingRemoteUpdate = false;
      }, 50);
    }

    if (this.config.enableTelemetry) {
      const mode = seeked ? 'HARD_SEEK' : (this.isSoftCorrecting ? 'SOFT_CORRECTION' : 'DEADBAND_IN_SYNC');
      console.debug(`[SYNC] rev=${this.lastAppliedRevision} auth=${estimatedServerPosition.toFixed(3)} local=${localTime.toFixed(3)} drift=${Math.round(drift * 1000)}ms mode=${mode} rate=${appliedRate.toFixed(3)} latency=${Math.round(Math.abs(this.clockOffset))}ms`);
    }

    return {
      seeked,
      stateChanged,
      rateChanged,
      drift,
      correctedHostTime: estimatedServerPosition,
      appliedRate,
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
      } catch (err) {}
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

    const isSyncState = type === 'SYNC_STATE' || type === 'video:sync' || type === 'sync:state' || type === 'video_sync' || type === 'player:heartbeat';
    const isCommand = type === 'SYNC_COMMAND';
    const isPlayEvent = isCommand ? msg.command === 'play' : (type === 'video:play' || type === 'sync:play' || type === 'play_video' || type === 'sync_play');
    const isPauseEvent = isCommand ? msg.command === 'pause' : (type === 'video:pause' || type === 'sync:pause' || type === 'pause_video' || type === 'sync_pause');
    const isSeekEvent = isCommand ? msg.command === 'seek' : (type === 'video:seek' || type === 'sync:seek' || type === 'seek_video' || type === 'sync_seek' || type === 'player:seek');

    if (!isSyncState && !isCommand && !isPlayEvent && !isPauseEvent && !isSeekEvent && type !== 'player:state' && type !== 'room_state') {
      return;
    }

    // Extract position/time
    let time = 0;
    if (typeof msg.position === 'number') time = msg.position;
    else if (typeof msg.time === 'number') time = msg.time;
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
    if (typeof msg.playbackRate === 'number' && msg.playbackRate > 0) rate = msg.playbackRate;
    else if (typeof msg.rate === 'number' && msg.rate > 0) rate = msg.rate;
    else if (this.lastHostState.rate > 0) rate = this.lastHostState.rate;

    const updatedAt = (typeof msg.updatedAt === 'number' && msg.updatedAt > 0)
      ? msg.updatedAt
      : (msg.payload?.ts || Date.now());

    this.lastHostState = {
      time,
      playing,
      rate,
      updatedAt,
      serverTime: msg.serverTime || updatedAt,
      revision: msg.revision || this.lastAppliedRevision,
    };

    // If we are a guest, apply authoritative updates immediately
    if (!this.isHost) {
      this.isApplyingRemoteUpdate = true;
      try {
        if (isPlayEvent) {
          this.lastHostState.playing = true;
          this.player.play();
          const targetPos = this.calculateEstimatedServerPosition();
          const localTime = this.player.getCurrentTime();
          if (Math.abs(localTime - targetPos) >= this.config.hardSeekThresholdSeconds) {
            this.player.seekTo(targetPos);
          }
        } else if (isPauseEvent) {
          this.lastHostState.playing = false;
          this.player.pause();
          if (time > 0 || (time === 0 && Math.abs(this.player.getCurrentTime()) > 0.1)) {
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
      console.warn('[SyncController] sendWsMessage failed:', e);
    }
  }

  public getLastHostState() {
    return { ...this.lastHostState };
  }
}

// Backward-compatible alias
export const VideoSyncPlugin = SyncController;
export type VideoSyncPlugin = SyncController;
export default SyncController;
