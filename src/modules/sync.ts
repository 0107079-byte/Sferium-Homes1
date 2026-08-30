/**
 * Frontend Synchronization Module for Sferium Homes (Compatibility Layer)
 * Wraps around the authoritative SyncController to provide seamless backward compatibility
 * for components listening to room state, video change, and remote control events.
 */

import { RoomState, VideoProvider } from '../types';
import { syncSocket, SocketMessage } from '../ws/socket';
import { extractVideoId, VideoPlatform } from '../utils/extractVideoId';
import { normalizeUrl } from '../utils/normalizeUrl';
import { HeartbeatPayload } from './heartbeat';
import { SyncController, PlayerAdapter, wrapAsUnifiedPlayer } from '../plugins/videoSync';

export type { PlayerAdapter };

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
 */
export async function seekSafe(player: any, time: number, shouldPlay: boolean = true, provider?: string): Promise<void> {
  if (!player) return;

  try {
    await waitUntilReady(player);
    const unified = wrapAsUnifiedPlayer(player);
    unified.seekTo(time);
    if (shouldPlay) {
      unified.play();
    } else {
      unified.pause();
    }
  } catch (err) {
    console.error('[seekSafe] Failed to safely seek:', err);
  }
}

export class SyncEngine {
  private roomState: RoomState | null = null;
  public driftThreshold: number = 0.35;
  private boundPlayer: PlayerAdapter | null = null;
  private isMasterRemote: boolean = false;
  private syncController: SyncController | null = null;

  private onStateChangeCallbacks: Set<(state: RoomState) => void> = new Set();
  private onVideoChangeCallbacks: Set<(video: { url: string; platform: VideoPlatform; id: string }) => void> = new Set();
  private onPlayCallbacks: Set<(time: number) => void> = new Set();
  private onPauseCallbacks: Set<(time: number) => void> = new Set();
  private onSeekCallbacks: Set<(time: number) => void> = new Set();
  private onHeartbeatCallbacks: Set<(payload: HeartbeatPayload) => void> = new Set();

  constructor() {
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    syncSocket.on('SYNC_STATE', (data: any) => {
      const rawHostTime = Number(data.position !== undefined ? data.position : data.currentTime ?? data.time ?? 0);
      const hostPlaying = Boolean(data.playing !== undefined ? data.playing : data.isPlaying);
      const hostProvider = (data.hostProvider || data.provider || 'youtube') as VideoProvider;

      if (this.roomState) {
        this.roomState.hostTime = rawHostTime;
        this.roomState.currentTime = rawHostTime;
        this.roomState.hostPlaying = hostPlaying;
        this.roomState.playing = hostPlaying;
        this.roomState.isPlaying = hostPlaying;
        this.roomState.hostProvider = hostProvider;
        if (data.provider) this.roomState.provider = data.provider as VideoProvider;
      }

      this.onHeartbeatCallbacks.forEach((cb) => cb({
        roomId: data.roomId || '',
        senderId: data.senderId || data.userId || '',
        time: rawHostTime,
        currentTime: rawHostTime,
        state: hostPlaying ? 'playing' : 'paused',
        isPlaying: hostPlaying,
        playbackRate: data.rate || data.playbackRate || 1,
        timestamp: data.updatedAt || Date.now(),
      }));
    });

    syncSocket.on('room_state', (data: SocketMessage) => {
      if (data.state) {
        this.handleServerState(data.state);
      }
    });

    syncSocket.on('change_video', (data: SocketMessage) => {
      if (data.videoUrl) {
        this.handleVideoChange(data.videoUrl);
      }
    });
  }

  public bindPlayer(player: PlayerAdapter | any) {
    this.boundPlayer = wrapAsUnifiedPlayer(player);
  }

  public setMaster(isMaster: boolean) {
    this.isMasterRemote = isMaster;
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
    syncSocket.sendPlay(time);
  }

  public remotePause(time: number) {
    syncSocket.sendPause(time);
  }

  public remoteSeek(targetTime: number) {
    syncSocket.sendSeek(targetTime);
  }

  public remoteHeartbeat(time: number, isPlaying: boolean, playbackRate: number = 1) {
    const provider = this.roomState?.provider || 'youtube';
    syncSocket.sendVideoSync({
      hostTime: time,
      hostPlaying: isPlaying,
      hostProvider: provider,
      rate: playbackRate,
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
