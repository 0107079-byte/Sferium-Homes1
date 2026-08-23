import { autoSyncEngine } from '../utils/AutoSync';
import {
  VideoSyncPlugin,
  HTML5VideoPlayerAdapter,
  YouTubePlayerAdapter,
  VKVideoPlayerAdapter,
  GenericPlayerAdapter,
  wrapAsUnifiedPlayer,
  applySync,
} from '../plugins/videoSync';
import type { UnifiedPlayer } from '../plugins/videoSync';

export type { UnifiedPlayer };
export {
  VideoSyncPlugin,
  HTML5VideoPlayerAdapter,
  YouTubePlayerAdapter,
  VKVideoPlayerAdapter,
  GenericPlayerAdapter,
  wrapAsUnifiedPlayer,
  applySync,
};

export interface VideoSyncInitOptions {
  roomId: string;
  ws: WebSocket | any;
  getVideoElement?: () => HTMLVideoElement | null;
  getYouTubePlayer?: () => any;
  getVKPlayer?: () => any;
  getRutubePlayer?: () => any;
  getUniversalPlayer?: () => any;
  driftThreshold?: number; // default 0.3s
  isHost?: boolean;
  onSyncEvent?: (event: { type: string; time?: number; isPlaying?: boolean; drift?: number }) => void;
}

export interface VideoSyncController {
  sendPlay: (time?: number) => void;
  sendPause: (time?: number) => void;
  sendSeek: (time: number) => void;
  sendState: (time: number, isPlaying: boolean) => void;
  plugin?: VideoSyncPlugin;
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

  // Хост отправляет состояние каждые 500 мс
  public hostBroadcast(currentTime: number, isPlaying: boolean, rate: number = 1.0) {
    if (!this.isHost) return;

    this.lastHostTime = currentTime;
    this.lastHostPlaying = isPlaying;
    const now = Date.now();
    this.lastUpdate = now;

    this.send({
      type: "video:sync",
      roomId: this.roomId,
      time: currentTime,
      playing: isPlaying,
      rate,
      updatedAt: now,
    });

    this.send({
      type: "sync:state",
      roomId: this.roomId,
      time: currentTime,
      currentTime,
      isPlaying,
      playing: isPlaying,
      rate,
      payload: {
        time: currentTime,
        playing: isPlaying,
        rate,
        ts: now,
      },
    });
  }

  // Гость получает состояние от хоста
  public applyHostState(player: any, payload: { time: number; playing: boolean; ts?: number; rate?: number }) {
    if (!player) return;
    const hostTime = typeof payload.time === 'number' ? payload.time : 0;
    const hostPlaying = Boolean(payload.playing);
    const hostRate = typeof payload.rate === 'number' ? payload.rate : 1.0;

    const unified = wrapAsUnifiedPlayer(player);
    const localTime = unified.getCurrentTime();
    const localPlaying = typeof unified.isPlaying === 'function' ? unified.isPlaying() : false;
    const localRate = unified.getPlaybackRate();

    applySync(unified, localTime, hostTime, localPlaying, hostPlaying, localRate, hostRate, payload.ts);
  }

  // Хост → play
  public sendPlay(time?: number) {
    if (!this.isHost) return;
    const now = Date.now();
    this.send({
      type: "video:play",
      roomId: this.roomId,
      time,
      playing: true,
      updatedAt: now,
    });
    this.send({
      type: "sync:play",
      roomId: this.roomId,
      time,
    });
  }

  // Хост → pause
  public sendPause(time?: number) {
    if (!this.isHost) return;
    const now = Date.now();
    this.send({
      type: "video:pause",
      roomId: this.roomId,
      time,
      playing: false,
      updatedAt: now,
    });
    this.send({
      type: "sync:pause",
      roomId: this.roomId,
      time,
    });
  }

  // Хост → seek
  public sendSeek(time: number) {
    if (!this.isHost) return;
    const now = Date.now();
    this.send({
      type: "video:seek",
      roomId: this.roomId,
      time,
      updatedAt: now,
    });
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
 * Client-side synchronized playback controller powered by VideoSyncPlugin.
 */
export function initVideoSync({
  roomId,
  ws,
  getVideoElement,
  getYouTubePlayer,
  getVKPlayer,
  getRutubePlayer,
  getUniversalPlayer,
  driftThreshold = 0.3,
  isHost = false,
  onSyncEvent,
}: VideoSyncInitOptions): VideoSyncController {
  function getActiveRawPlayer(): any {
    try {
      const vid = getVideoElement ? getVideoElement() : null;
      if (vid) return vid;
      const yt = getYouTubePlayer ? getYouTubePlayer() : null;
      if (yt) return yt;
      const vk = getVKPlayer ? getVKPlayer() : null;
      if (vk) return vk;
      const ru = getRutubePlayer ? getRutubePlayer() : null;
      if (ru) return ru;
      const un = getUniversalPlayer ? getUniversalPlayer() : null;
      if (un) return un;
    } catch (e) {
      console.warn('[syncVideoClient] resolve error:', e);
    }
    return null;
  }

  // Dynamic player proxy that always forwards to active player instance
  const dynamicPlayer: UnifiedPlayer = {
    play: () => {
      const p = getActiveRawPlayer();
      if (p) wrapAsUnifiedPlayer(p).play();
    },
    pause: () => {
      const p = getActiveRawPlayer();
      if (p) wrapAsUnifiedPlayer(p).pause();
    },
    seekTo: (time: number) => {
      const p = getActiveRawPlayer();
      if (p) wrapAsUnifiedPlayer(p).seekTo(time);
    },
    getCurrentTime: () => {
      const p = getActiveRawPlayer();
      return p ? wrapAsUnifiedPlayer(p).getCurrentTime() : 0;
    },
    getDuration: () => {
      const p = getActiveRawPlayer();
      return p ? wrapAsUnifiedPlayer(p).getDuration() : 0;
    },
    setPlaybackRate: (rate: number) => {
      const p = getActiveRawPlayer();
      if (p) wrapAsUnifiedPlayer(p).setPlaybackRate(rate);
    },
    getPlaybackRate: () => {
      const p = getActiveRawPlayer();
      return p ? wrapAsUnifiedPlayer(p).getPlaybackRate() : 1.0;
    },
    isPlaying: () => {
      const p = getActiveRawPlayer();
      return p && wrapAsUnifiedPlayer(p).isPlaying ? wrapAsUnifiedPlayer(p).isPlaying!() : false;
    },
  };

  const plugin = new VideoSyncPlugin(dynamicPlayer, ws, isHost, roomId);
  plugin.start();

  function send(type: string, payload: Record<string, any> = {}) {
    if (!ws) return;
    const packet = JSON.stringify({ type, roomId, updatedAt: Date.now(), ...payload });
    if (typeof ws.send === 'function') {
      if (ws.readyState === undefined || ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
        ws.send(packet);
      }
    }
  }

  return {
    sendPlay(time?: number) {
      const t = time !== undefined ? time : dynamicPlayer.getCurrentTime();
      plugin.notifyPlay();
      send('video:play', { time: t, playing: true });
      send('sync:play', { currentTime: t, time: t });
      onSyncEvent?.({ type: 'play', isPlaying: true, time: t });
    },
    sendPause(time?: number) {
      const t = time !== undefined ? time : dynamicPlayer.getCurrentTime();
      plugin.notifyPause();
      send('video:pause', { time: t, playing: false });
      send('sync:pause', { currentTime: t, time: t });
      onSyncEvent?.({ type: 'pause', isPlaying: false, time: t });
    },
    sendSeek(time: number) {
      plugin.notifySeek(time);
      send('video:seek', { time, currentTime: time });
      send('sync:seek', { time, currentTime: time, payload: { time } });
      onSyncEvent?.({ type: 'seek', time });
    },
    sendState(time: number, isPlaying: boolean) {
      send('video:sync', { time, currentTime: time, playing: isPlaying, rate: 1.0 });
      send('sync:state', { time, currentTime: time, isPlaying, playing: isPlaying });
      onSyncEvent?.({ type: 'state', time, isPlaying });
    },
    plugin,
    destroy() {
      plugin.stop();
    },
  };
}

export default initVideoSync;
