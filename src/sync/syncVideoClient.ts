import { autoSyncEngine } from '../utils/AutoSync';

export interface VideoSyncInitOptions {
  roomId: string;
  ws: WebSocket | any;
  getVideoElement?: () => HTMLVideoElement | null;
  getYouTubePlayer?: () => any;
  getVKPlayer?: () => any;
  getRutubePlayer?: () => any;
  getUniversalPlayer?: () => any;
  driftThreshold?: number; // default 0.5s
  onSyncEvent?: (event: { type: string; time?: number; isPlaying?: boolean; drift?: number }) => void;
}

export interface VideoSyncController {
  sendPlay: (time?: number) => void;
  sendPause: (time?: number) => void;
  sendSeek: (time: number) => void;
  sendState: (time: number, isPlaying: boolean) => void;
  destroy: () => void;
}

export class SyncVideoClient {
  public roomId: string;
  public userId?: string;
  public isHost: boolean;
  public send: (msg: any) => void;
  public lastHostTime: number;
  public lastHostPlaying: boolean;
  public lastUpdate: number;

  constructor({
    roomId,
    userId,
    isHost,
    send,
  }: {
    roomId: string;
    userId?: string;
    isHost: boolean;
    send: (msg: any) => void;
  }) {
    this.roomId = roomId;
    this.userId = userId;
    this.isHost = isHost;
    this.send = send;

    this.lastHostTime = 0;
    this.lastHostPlaying = false;
    this.lastUpdate = Date.now();
  }

  // Хост отправляет состояние каждые 500–1000 мс
  public hostBroadcast(currentTime: number, isPlaying: boolean) {
    if (!this.isHost) return;

    this.lastHostTime = currentTime;
    this.lastHostPlaying = isPlaying;
    this.lastUpdate = Date.now();

    this.send({
      type: "sync:state",
      roomId: this.roomId,
      time: currentTime,
      currentTime,
      isPlaying,
      playing: isPlaying,
      payload: {
        time: currentTime,
        playing: isPlaying,
        ts: Date.now(),
      },
    });
  }

  // Гость получает состояние от хоста
  public applyHostState(player: any, payload: { time: number; playing: boolean; ts?: number }) {
    if (!player) return;
    const hostTime = typeof payload.time === 'number' ? payload.time : 0;
    const hostPlaying = Boolean(payload.playing);

    const localTime = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : (player.currentTime || 0);
    const drift = Math.abs(localTime - hostTime);

    // Жёсткая коррекция при расхождении > 0.7 сек
    if (drift > 0.7) {
      if (typeof player.seekTo === 'function') {
        player.seekTo(hostTime);
      } else if (typeof player.currentTime !== 'undefined') {
        player.currentTime = hostTime;
      }
    }

    // Синхронизация play/pause
    const isLocalPlaying = typeof player.isPlaying === 'function' ? player.isPlaying() : !player.paused;
    if (hostPlaying && !isLocalPlaying) {
      if (typeof player.play === 'function') player.play();
    }
    if (!hostPlaying && isLocalPlaying) {
      if (typeof player.pause === 'function') player.pause();
    }
  }

  // Хост → play
  public sendPlay() {
    if (!this.isHost) return;
    this.send({
      type: "sync:play",
      roomId: this.roomId,
    });
  }

  // Хост → pause
  public sendPause() {
    if (!this.isHost) return;
    this.send({
      type: "sync:pause",
      roomId: this.roomId,
    });
  }

  // Хост → seek
  public sendSeek(time: number) {
    if (!this.isHost) return;
    this.send({
      type: "sync:seek",
      roomId: this.roomId,
      time,
      currentTime: time,
      payload: { time },
    });
  }
}

/**
 * initVideoSync
 * Client-side synchronized playback controller supporting HTML5 Video,
 * YouTube iframe API, VK Video player, and Rutube player.
 */
export function initVideoSync({
  roomId,
  ws,
  getVideoElement,
  getYouTubePlayer,
  getVKPlayer,
  getRutubePlayer,
  getUniversalPlayer,
  driftThreshold = 0.5,
  onSyncEvent,
}: VideoSyncInitOptions): VideoSyncController {
  let video: HTMLVideoElement | null = null;
  let yt: any = null;
  let vk: any = null;
  let rutube: any = null;
  let universal: any = null;

  function resolvePlayers() {
    try {
      video = getVideoElement ? getVideoElement() : null;
      yt = getYouTubePlayer ? getYouTubePlayer() : null;
      vk = getVKPlayer ? getVKPlayer() : null;
      rutube = getRutubePlayer ? getRutubePlayer() : null;
      universal = getUniversalPlayer ? getUniversalPlayer() : null;
    } catch (e) {
      console.warn('[syncVideoClient] Player resolution error:', e);
    }
  }

  resolvePlayers();

  const handleMessage = (event: MessageEvent | any) => {
    try {
      const dataStr =
        typeof event.data === 'string'
          ? event.data
          : typeof event === 'string'
          ? event
          : JSON.stringify(event);
      const msg =
        typeof event.data === 'object' &&
        event.data !== null &&
        !(event.data instanceof Blob) &&
        !(event.data instanceof ArrayBuffer)
          ? event.data
          : JSON.parse(dataStr);

      if (!msg || (msg.roomId && msg.roomId !== roomId)) return;

      resolvePlayers();

      switch (msg.type) {
        case 'sync:play':
        case 'play_video':
        case 'sync_play': {
          if (video && typeof video.play === 'function') {
            video.play().catch(() => {});
          }
          if (yt) {
            if (typeof yt.playVideo === 'function') yt.playVideo();
            else if (typeof yt.play === 'function') yt.play();
          }
          if (vk && typeof vk.play === 'function') {
            vk.play();
          }
          if (rutube && typeof rutube.play === 'function') {
            rutube.play();
          }
          if (universal && typeof universal.play === 'function') {
            universal.play();
          }
          onSyncEvent?.({ type: 'play', isPlaying: true });
          break;
        }

        case 'sync:pause':
        case 'pause_video':
        case 'sync_pause': {
          if (video && typeof video.pause === 'function') {
            video.pause();
          }
          if (yt) {
            if (typeof yt.pauseVideo === 'function') yt.pauseVideo();
            else if (typeof yt.pause === 'function') yt.pause();
          }
          if (vk && typeof vk.pause === 'function') {
            vk.pause();
          }
          if (rutube && typeof rutube.pause === 'function') {
            rutube.pause();
          }
          if (universal && typeof universal.pause === 'function') {
            universal.pause();
          }
          onSyncEvent?.({ type: 'pause', isPlaying: false });
          break;
        }

        case 'sync:seek':
        case 'player:seek':
        case 'seek_video': {
          const seekTime = typeof msg.time === 'number' ? msg.time : parseFloat(msg.currentTime || 0);
          if (typeof seekTime === 'number' && !isNaN(seekTime)) {
            if (video) video.currentTime = seekTime;
            if (yt && typeof yt.seekTo === 'function') yt.seekTo(seekTime, true);
            if (vk && typeof vk.seekTo === 'function') vk.seekTo(seekTime);
            if (rutube && typeof rutube.seekTo === 'function') rutube.seekTo(seekTime);
            if (universal && typeof universal.seekTo === 'function') universal.seekTo(seekTime);

            autoSyncEngine.markManualSync(seekTime);
            onSyncEvent?.({ type: 'seek', time: seekTime });
          }
          break;
        }

        case 'sync:state':
        case 'player:state':
        case 'video_sync': {
          const target =
            typeof msg.time === 'number'
              ? msg.time
              : typeof msg.currentTime === 'number'
              ? msg.currentTime
              : typeof msg.hostTime === 'number'
              ? msg.hostTime
              : undefined;

          const isPlaying = Boolean(msg.isPlaying ?? msg.playing ?? msg.hostPlaying);

          if (typeof target === 'number' && !isNaN(target)) {
            // HTML5 Video
            if (video) {
              const diff = Math.abs(video.currentTime - target);
              autoSyncEngine.reportPlaybackTime(video.currentTime, target, isPlaying);
              if (diff > driftThreshold) {
                video.currentTime = target;
              }
              if (isPlaying && video.paused) {
                video.play().catch(() => {});
              } else if (!isPlaying && !video.paused) {
                video.pause();
              }
            }

            // YouTube Player
            if (yt) {
              const ytTime = typeof yt.getCurrentTime === 'function' ? yt.getCurrentTime() : 0;
              const diff = Math.abs(ytTime - target);
              autoSyncEngine.reportPlaybackTime(ytTime, target, isPlaying);
              if (diff > driftThreshold && typeof yt.seekTo === 'function') {
                yt.seekTo(target, true);
              }
              if (isPlaying) {
                if (typeof yt.playVideo === 'function') yt.playVideo();
                else if (typeof yt.play === 'function') yt.play();
              } else {
                if (typeof yt.pauseVideo === 'function') yt.pauseVideo();
                else if (typeof yt.pause === 'function') yt.pause();
              }
            }

            // VK Video Player
            if (vk) {
              const vkTime = typeof vk.getCurrentTime === 'function' ? vk.getCurrentTime() : 0;
              const diff = Math.abs(vkTime - target);
              autoSyncEngine.reportPlaybackTime(vkTime, target, isPlaying);
              if (diff > driftThreshold && typeof vk.seekTo === 'function') {
                vk.seekTo(target);
              }
              if (isPlaying && typeof vk.play === 'function') {
                vk.play();
              } else if (!isPlaying && typeof vk.pause === 'function') {
                vk.pause();
              }
            }

            // Rutube Player
            if (rutube) {
              const rutubeTime = typeof rutube.getCurrentTime === 'function' ? rutube.getCurrentTime() : 0;
              const diff = Math.abs(rutubeTime - target);
              autoSyncEngine.reportPlaybackTime(rutubeTime, target, isPlaying);
              if (diff > driftThreshold && typeof rutube.seekTo === 'function') {
                rutube.seekTo(target);
              }
              if (isPlaying && typeof rutube.play === 'function') {
                rutube.play();
              } else if (!isPlaying && typeof rutube.pause === 'function') {
                rutube.pause();
              }
            }

            // Universal Player
            if (universal) {
              const uTime = typeof universal.getCurrentTime === 'function' ? universal.getCurrentTime() : 0;
              const diff = Math.abs(uTime - target);
              autoSyncEngine.reportPlaybackTime(uTime, target, isPlaying);
              if (diff > driftThreshold && typeof universal.seekTo === 'function') {
                universal.seekTo(target);
              }
              if (isPlaying && typeof universal.play === 'function') {
                universal.play();
              } else if (!isPlaying && typeof universal.pause === 'function') {
                universal.pause();
              }
            }

            onSyncEvent?.({ type: 'state', time: target, isPlaying });
          }
          break;
        }
      }
    } catch (err) {
      // Non-JSON or irrelevant message
    }
  };

  if (ws && typeof ws.addEventListener === 'function') {
    ws.addEventListener('message', handleMessage);
  } else if (ws && typeof ws.on === 'function') {
    ws.on('message', handleMessage);
    ws.on('sync:play', handleMessage);
    ws.on('sync:pause', handleMessage);
    ws.on('sync:seek', handleMessage);
    ws.on('sync:state', handleMessage);
    ws.on('*', handleMessage);
  }

  function send(type: string, payload: Record<string, any> = {}) {
    if (!ws) return;
    const packet = JSON.stringify({ type, roomId, ...payload });
    if (typeof ws.send === 'function') {
      if (ws.readyState === undefined || ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
        ws.send(packet);
      }
    }
  }

  return {
    sendPlay(time?: number) {
      send('sync:play', time !== undefined ? { currentTime: time, time } : {});
    },
    sendPause(time?: number) {
      send('sync:pause', time !== undefined ? { currentTime: time, time } : {});
    },
    sendSeek(time: number) {
      send('sync:seek', { time, currentTime: time });
    },
    sendState(time: number, isPlaying: boolean) {
      send('sync:state', { time, currentTime: time, isPlaying });
    },
    destroy() {
      if (ws && typeof ws.removeEventListener === 'function') {
        ws.removeEventListener('message', handleMessage);
      } else if (ws && typeof ws.off === 'function') {
        ws.off('message', handleMessage);
      }
    },
  };
}

export default initVideoSync;
