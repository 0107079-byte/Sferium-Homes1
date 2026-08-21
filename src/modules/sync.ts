/**
 * Frontend Hard-Synchronization Engine for Sferium Homes
 * The Remote Control is the SINGLE authoritative source of truth.
 * All Players (YouTube, VK, Rutube, HTML5 Video) are SLAVES that strictly obey the Remote.
 */

import { RoomState, VideoProvider } from '../types';
import { syncSocket, SocketMessage } from '../ws/socket';
import { extractVideoId, VideoPlatform } from '../utils/extractVideoId';
import { normalizeUrl } from '../utils/normalizeUrl';
import { HeartbeatPayload } from './heartbeat';

export interface PlayerAdapter {
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  play: () => void | Promise<void>;
  pause: () => void;
  isReady?: () => boolean;
  getDuration?: () => number;
  provider?: string;
}

/**
 * Wait until player instance is ready and responsive
 */
export async function waitUntilReady(player: any, timeoutMs: number = 3000): Promise<boolean> {
  if (!player) return false;
  if (typeof player.isReady === 'function' && player.isReady()) return true;

  const startTime = Date.now();
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (!player) {
        clearInterval(checkInterval);
        resolve(false);
        return;
      }

      const ready = typeof player.isReady === 'function' ? player.isReady() : true;
      if (ready || Date.now() - startTime >= timeoutMs) {
        clearInterval(checkInterval);
        resolve(ready);
      }
    }, 50);
  });
}

/**
 * Safe Seek Function for All Players (YouTube, VK, Rutube, HTML5)
 * Adheres strictly to provider requirements:
 * - YouTube: player.seekTo(time, true)
 * - VK Video: video.pause() -> video.currentTime = time -> setTimeout(() => video.play(), 180)
 * - Rutube & HTML5: video.currentTime = time
 */
export async function seekSafe(player: any, time: number, shouldPlay: boolean = true, provider?: string): Promise<void> {
  if (!player) return;

  try {
    await waitUntilReady(player);

    const activeProvider = provider || player.provider || '';
    const isVk = activeProvider.includes('vk') || (typeof player.isVk === 'function' && player.isVk());

    if (isVk) {
      // VK Specific seek behavior with 180ms recovery window
      if (typeof player.pause === 'function') {
        try { player.pause(); } catch {}
      } else if (player.video && typeof player.video.pause === 'function') {
        try { player.video.pause(); } catch {}
      }

      if (typeof player.seekTo === 'function') {
        try { player.seekTo(time, true); } catch {}
      } else if ('currentTime' in player) {
        player.currentTime = time;
      } else if (player.video && 'currentTime' in player.video) {
        player.video.currentTime = time;
      }

      if (shouldPlay) {
        setTimeout(() => {
          try {
            if (typeof player.play === 'function') {
              player.play();
            } else if (player.video && typeof player.video.play === 'function') {
              player.video.play();
            }
          } catch (e) {
            console.warn('[seekSafe VK] Error resuming play:', e);
          }
        }, 180);
      }
      return;
    }

    // YouTube, Rutube, HTML5
    if (typeof player.pause === 'function' && !shouldPlay) {
      try { player.pause(); } catch {}
    }

    if (typeof player.seekTo === 'function') {
      player.seekTo(time, true);
    } else if ('currentTime' in player) {
      player.currentTime = time;
    }

    if (shouldPlay) {
      setTimeout(() => {
        try {
          if (typeof player.play === 'function') {
            player.play();
          }
        } catch (e) {
          console.warn('[seekSafe] Error resuming play:', e);
        }
      }, 50);
    }
  } catch (err) {
    console.error('[seekSafe] Failed to safely seek:', err);
  }
}

export class SyncEngine {
  private roomState: RoomState | null = null;
  // Host = source of truth. Guest drift threshold = 0.7s
  public driftThreshold: number = 0.7; 
  private boundPlayer: PlayerAdapter | null = null;
  private isMasterRemote: boolean = false;
  private guestSyncInterval: any = null;
  private lastSeekTime: number = 0; // Cooldown to prevent seek storms under packet loss / buffer stalls

  private onStateChangeCallbacks: Set<(state: RoomState) => void> = new Set();
  private onVideoChangeCallbacks: Set<(video: { url: string; platform: VideoPlatform; id: string }) => void> = new Set();
  private onPlayCallbacks: Set<(time: number) => void> = new Set();
  private onPauseCallbacks: Set<(time: number) => void> = new Set();
  private onSeekCallbacks: Set<(time: number) => void> = new Set();
  private onHeartbeatCallbacks: Set<(payload: HeartbeatPayload) => void> = new Set();

  constructor() {
    this.setupSocketListeners();
    this.startGuestSyncLoop();
  }

  private startGuestSyncLoop() {
    if (this.guestSyncInterval) clearInterval(this.guestSyncInterval);
    // Guests check drift every 1000ms
    this.guestSyncInterval = setInterval(() => {
      this.checkGuestAlignment();
    }, 1000);
  }

  private checkGuestAlignment() {
    if (this.isMasterRemote) return; // Master does not align to itself
    if (!this.boundPlayer || !this.roomState) return;

    // Buffer cooldown: don't auto-seek if we recently sought (< 1200ms)
    const now = Date.now();
    if (now - this.lastSeekTime < 1200) return;

    const hostTime = this.roomState.hostTime ?? this.roomState.currentTime ?? 0;
    const hostPlaying = this.roomState.hostPlaying ?? this.roomState.playing ?? false;
    const currentLocalTime = typeof this.boundPlayer.getCurrentTime === 'function' ? this.boundPlayer.getCurrentTime() : 0;

    const diff = Math.abs(currentLocalTime - hostTime);
    if (diff > this.driftThreshold) {
      this.lastSeekTime = now;
      seekSafe(this.boundPlayer, hostTime, hostPlaying, this.roomState.provider);
    } else {
      if (hostPlaying) {
        this.boundPlayer.play();
      } else {
        this.boundPlayer.pause();
      }
    }
  }

  private setupSocketListeners() {
    // 1. New host video_sync event with latency compensation
    syncSocket.on('video_sync', (data: SocketMessage) => {
      const rawHostTime = Number(data.hostTime !== undefined ? data.hostTime : data.currentTime ?? data.time ?? 0);
      const hostPlaying = Boolean(data.hostPlaying !== undefined ? data.hostPlaying : (data.playing ?? data.isPlaying));
      const hostProvider = (data.hostProvider || data.provider || 'youtube') as VideoProvider;

      // Latency compensation for network jitter (150-300ms)
      const now = Date.now();
      const packetTransitSec = data.timestamp ? Math.min(1.5, Math.max(0, (now - data.timestamp) / 1000)) : 0;
      const hostTime = hostPlaying ? rawHostTime + packetTransitSec : rawHostTime;

      if (this.roomState) {
        this.roomState.hostTime = hostTime;
        this.roomState.currentTime = hostTime;
        this.roomState.hostPlaying = hostPlaying;
        this.roomState.playing = hostPlaying;
        this.roomState.isPlaying = hostPlaying;
        this.roomState.hostProvider = hostProvider;
        if (data.provider) this.roomState.provider = data.provider as VideoProvider;
      }

      this.handleIncomingHeartbeat({
        roomId: data.roomId || '',
        senderId: data.senderId || data.userId || '',
        time: hostTime,
        currentTime: hostTime,
        state: hostPlaying ? 'playing' : 'paused',
        isPlaying: hostPlaying,
        playbackRate: data.playbackRate || 1,
        timestamp: data.timestamp || Date.now(),
      });
    });

    // 2. Hard-sync WebSocket events
    syncSocket.on('player:heartbeat', (data: SocketMessage) => {
      const time = Number(data.time !== undefined ? data.time : data.currentTime || 0);
      const isPlaying = Boolean(data.isPlaying !== undefined ? data.isPlaying : data.playing);
      if (this.roomState) {
        this.roomState.hostTime = time;
        this.roomState.currentTime = time;
        this.roomState.hostPlaying = isPlaying;
        this.roomState.playing = isPlaying;
      }

      this.handleIncomingHeartbeat({
        roomId: data.roomId || '',
        senderId: data.senderId || data.userId || '',
        time,
        currentTime: time,
        state: data.state || (isPlaying ? 'playing' : 'paused'),
        isPlaying,
        playbackRate: data.playbackRate || 1,
        timestamp: data.timestamp || Date.now(),
      });
    });

    syncSocket.on('player:seek', (data: SocketMessage) => {
      const targetTime = Number(data.currentTime !== undefined ? data.currentTime : data.time);
      if (!isNaN(targetTime)) {
        if (this.roomState) {
          this.roomState.hostTime = targetTime;
          this.roomState.currentTime = targetTime;
        }
        this.handleIncomingSeek(targetTime, Boolean(data.playing ?? true));
      }
    });

    syncSocket.on('player:state', (data: SocketMessage) => {
      const isPlaying = Boolean(data.playing ?? (data.state === 'playing'));
      const time = Number(data.currentTime ?? data.time ?? 0);
      if (this.roomState) {
        this.roomState.hostPlaying = isPlaying;
        this.roomState.playing = isPlaying;
        if (data.currentTime !== undefined || data.time !== undefined) {
          this.roomState.hostTime = time;
          this.roomState.currentTime = time;
        }
      }
      this.handleIncomingState(isPlaying, time);
    });

    // 3. Backward compatible events
    syncSocket.on('sync:state', (state: RoomState) => this.handleServerState(state));
    syncSocket.on('room_state', (data: SocketMessage) => {
      if (data.state) {
        this.handleServerState(data.state);
      }
    });

    syncSocket.on('heartbeat_sync', (data: SocketMessage) => {
      const time = Number(data.currentTime ?? data.time ?? 0);
      const isPlaying = Boolean(data.playing ?? data.isPlaying);
      this.handleIncomingHeartbeat({
        roomId: data.roomId || '',
        senderId: data.senderId || '',
        time,
        currentTime: time,
        state: isPlaying ? 'playing' : 'paused',
        isPlaying,
        playbackRate: data.playbackRate || 1,
        timestamp: Date.now(),
      });
    });

    syncSocket.on('sync:video_url', (data: SocketMessage) => {
      if (data.videoUrl) {
        this.handleVideoChange(data.videoUrl);
      }
    });

    syncSocket.on('sync:play', (data: SocketMessage) => {
      const time = Number(data.currentTime ?? 0);
      this.handleIncomingState(true, time);
    });

    syncSocket.on('sync:pause', (data: SocketMessage) => {
      const time = Number(data.currentTime ?? 0);
      this.handleIncomingState(false, time);
    });

    syncSocket.on('sync:seek', (data: SocketMessage) => {
      const targetTime = Number(data.currentTime ?? data.time);
      if (!isNaN(targetTime)) {
        this.handleIncomingSeek(targetTime, true);
      }
    });
  }

  /**
   * Bind the slave player adapter to this sync engine
   */
  public bindPlayer(player: PlayerAdapter | null) {
    this.boundPlayer = player;
  }

  public setMaster(isMaster: boolean) {
    this.isMasterRemote = isMaster;
  }

  /**
   * Hard Heartbeat Handler for Slave Player
   */
  public handleIncomingHeartbeat(payload: HeartbeatPayload) {
    this.onHeartbeatCallbacks.forEach((cb) => cb(payload));

    // If we are the master remote that emitted this, don't self-override
    if (this.isMasterRemote && payload.senderId === syncSocket.userId) {
      return;
    }

    // Update internal room state
    if (this.roomState) {
      this.roomState.currentTime = payload.currentTime;
      this.roomState.hostTime = payload.currentTime;
      this.roomState.playing = payload.isPlaying;
      this.roomState.isPlaying = payload.isPlaying;
      this.roomState.hostPlaying = payload.isPlaying;
    }

    if (!this.boundPlayer) return;

    const playerTime = this.boundPlayer.getCurrentTime ? this.boundPlayer.getCurrentTime() : 0;
    const timeDiff = Math.abs(playerTime - payload.currentTime);

    // Hard Sync Rule: If drift > 0.7s, force sync time immediately
    if (timeDiff > this.driftThreshold) {
      seekSafe(this.boundPlayer, payload.currentTime, payload.isPlaying, this.roomState?.provider);
    } else {
      // Ensure play/pause state is aligned
      if (payload.isPlaying) {
        this.boundPlayer.play();
      } else {
        this.boundPlayer.pause();
      }
    }
  }

  public handleIncomingSeek(targetTime: number, shouldPlay: boolean = true) {
    this.onSeekCallbacks.forEach((cb) => cb(targetTime));
    if (this.roomState) {
      this.roomState.currentTime = targetTime;
      this.roomState.hostTime = targetTime;
    }

    if (this.boundPlayer) {
      seekSafe(this.boundPlayer, targetTime, shouldPlay, this.roomState?.provider);
    }
  }

  public handleIncomingState(isPlaying: boolean, time?: number) {
    if (isPlaying) {
      this.onPlayCallbacks.forEach((cb) => cb(time || 0));
    } else {
      this.onPauseCallbacks.forEach((cb) => cb(time || 0));
    }

    if (this.roomState) {
      this.roomState.playing = isPlaying;
      this.roomState.isPlaying = isPlaying;
      this.roomState.hostPlaying = isPlaying;
      if (time !== undefined) {
        this.roomState.currentTime = time;
        this.roomState.hostTime = time;
      }
    }

    if (this.boundPlayer) {
      if (time !== undefined) {
        const cur = this.boundPlayer.getCurrentTime ? this.boundPlayer.getCurrentTime() : 0;
        if (Math.abs(cur - time) > this.driftThreshold) {
          seekSafe(this.boundPlayer, time, isPlaying, this.roomState?.provider);
          return;
        }
      }
      if (isPlaying) {
        this.boundPlayer.play();
      } else {
        this.boundPlayer.pause();
      }
    }
  }

  public handleServerState(state: RoomState) {
    const prevUrl = this.roomState?.videoUrl;
    this.roomState = state;

    if (state.videoUrl && state.videoUrl !== prevUrl) {
      this.handleVideoChange(state.videoUrl);
    }

    this.onStateChangeCallbacks.forEach((cb) => cb(state));
  }

  public handleVideoChange(rawUrl: string) {
    const normalized = normalizeUrl(rawUrl);
    const extracted = extractVideoId(normalized);
    if (extracted) {
      this.onVideoChangeCallbacks.forEach((cb) => cb({
        url: normalized,
        platform: extracted.platform,
        id: extracted.id,
      }));
    }
  }

  // Authoritative Remote Control Commands
  public remotePlay(time: number) {
    syncSocket.sendSyncCommand({ type: 'play' });
    syncSocket.sendPlayerState({
      playing: true,
      currentTime: time,
      state: 'playing',
    });
    syncSocket.sendPlay(time);
  }

  public remotePause(time: number) {
    syncSocket.sendSyncCommand({ type: 'pause' });
    syncSocket.sendPlayerState({
      playing: false,
      currentTime: time,
      state: 'paused',
    });
    syncSocket.sendPause(time);
  }

  public remoteSeek(targetTime: number) {
    syncSocket.sendSyncCommand({ type: 'seek', time: targetTime });
    syncSocket.sendPlayerSeek(targetTime);
    syncSocket.sendSeek(targetTime);
  }

  public remoteHeartbeat(time: number, isPlaying: boolean, playbackRate: number = 1) {
    const provider = this.roomState?.provider || 'youtube';
    syncSocket.sendVideoSync({
      hostTime: time,
      hostPlaying: isPlaying,
      hostProvider: provider,
    });
    syncSocket.sendPlayerHeartbeat({
      currentTime: time,
      time,
      playing: isPlaying,
      isPlaying,
      state: isPlaying ? 'playing' : 'paused',
      playbackRate,
    });
  }

  public changeVideo(rawUrl: string) {
    const normalized = normalizeUrl(rawUrl);
    const extracted = extractVideoId(normalized);
    const provider: VideoProvider = (extracted?.platform as VideoProvider) || 'unknown';
    const videoId = extracted?.id || '';
    syncSocket.sendVideoUrl(normalized, provider, videoId);
  }

  public forceSyncAll(currentTime: number) {
    this.remoteSeek(currentTime);
    syncSocket.send({
      type: 'force_sync',
      currentTime,
    });
  }

  // Listener subscriptions
  public onStateChange(cb: (state: RoomState) => void) {
    this.onStateChangeCallbacks.add(cb);
    return () => this.onStateChangeCallbacks.delete(cb);
  }

  public onVideoChange(cb: (video: { url: string; platform: VideoPlatform; id: string }) => void) {
    this.onVideoChangeCallbacks.add(cb);
    return () => this.onVideoChangeCallbacks.delete(cb);
  }

  public onPlay(cb: (time: number) => void) {
    this.onPlayCallbacks.add(cb);
    return () => this.onPlayCallbacks.delete(cb);
  }

  public onPause(cb: (time: number) => void) {
    this.onPauseCallbacks.add(cb);
    return () => this.onPauseCallbacks.delete(cb);
  }

  public onSeek(cb: (time: number) => void) {
    this.onSeekCallbacks.add(cb);
    return () => this.onSeekCallbacks.delete(cb);
  }

  public onHeartbeat(cb: (payload: HeartbeatPayload) => void) {
    this.onHeartbeatCallbacks.add(cb);
    return () => this.onHeartbeatCallbacks.delete(cb);
  }

  public getState(): RoomState | null {
    return this.roomState;
  }
}

export const syncEngine = new SyncEngine();
