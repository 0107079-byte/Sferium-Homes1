/**
 * AutoSync Engine for Watch Party
 * Monitored playhead drift, automatic catchup, latency tracking, and sync event broadcasting.
 */
import { SyncStatusInfo } from '../types';
import { applySync, wrapAsUnifiedPlayer } from '../plugins/videoSync';

export type AutoSyncState = SyncStatusInfo;

type SyncListener = (status: SyncStatusInfo) => void;

class AutoSyncEngine {
  private listeners: Set<SyncListener> = new Set();
  private status: SyncStatusInfo = {
    isSyncing: false,
    driftSeconds: 0,
    latencyMs: 0,
    lastSyncedAt: Date.now(),
    serverTime: 0,
    localTime: 0,
  };
  private syncTimeout: any = null;

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public reportPlaybackTime(localTime: number, serverTime: number, isPlaying: boolean): { needsSeek: boolean; drift: number } {
    const drift = Math.abs(serverTime - localTime);
    const now = Date.now();
    const isOutOfSync = drift > 0.3; // Strict 300ms drift threshold

    this.status = {
      isSyncing: isOutOfSync,
      driftSeconds: Math.round(drift * 100) / 100,
      latencyMs: Math.round(drift * 1000),
      lastSyncedAt: isOutOfSync ? this.status.lastSyncedAt : now,
      serverTime,
      localTime,
    };

    this.notify();

    if (isOutOfSync) {
      if (this.syncTimeout) clearTimeout(this.syncTimeout);
      this.syncTimeout = setTimeout(() => {
        this.status.isSyncing = false;
        this.status.lastSyncedAt = Date.now();
        this.notify();
      }, 1000);
    }

    return {
      needsSeek: drift > 0.3,
      drift,
    };
  }

  public markManualSync(serverTime: number) {
    this.status = {
      isSyncing: true,
      driftSeconds: 0,
      latencyMs: 15,
      lastSyncedAt: Date.now(),
      serverTime,
      localTime: serverTime,
    };
    this.notify();
    setTimeout(() => {
      this.status.isSyncing = false;
      this.notify();
    }, 500);
  }

  public getStatus(): SyncStatusInfo {
    return { ...this.status };
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.status);
      } catch (e) {
        console.error('[AutoSync notify error]', e);
      }
    });
  }
}

export const autoSyncEngine = new AutoSyncEngine();

/**
 * startAutoSync
 * Timeline drift correction loop using hardened applySync algorithm.
 */
export function startAutoSync(player: any, sync: { currentTime?: number; isPlaying?: boolean; rate?: number } | any): () => void {
  const unified = wrapAsUnifiedPlayer(player);

  const interval = setInterval(() => {
    if (!player) return;

    const localTime = unified.getCurrentTime();
    const localPlaying = typeof unified.isPlaying === 'function' ? unified.isPlaying() : false;
    const localRate = unified.getPlaybackRate();

    const hostTime =
      typeof sync.currentTime === 'function'
        ? sync.currentTime()
        : sync.currentTime !== undefined
        ? sync.currentTime
        : 0;

    const hostPlaying =
      typeof sync.isPlaying === 'function'
        ? sync.isPlaying()
        : sync.isPlaying !== undefined
        ? Boolean(sync.isPlaying)
        : (sync.playing !== undefined ? Boolean(sync.playing) : localPlaying);

    const hostRate =
      typeof sync.rate === 'function'
        ? sync.rate()
        : sync.rate !== undefined
        ? Number(sync.rate)
        : 1.0;

    applySync(unified, localTime, hostTime, localPlaying, hostPlaying, localRate, hostRate);
  }, 800);

  return () => clearInterval(interval);
}

export default startAutoSync;

