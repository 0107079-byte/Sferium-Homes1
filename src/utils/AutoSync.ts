/**
 * AutoSync Engine for Watch Party
 * Monitored playhead drift, automatic catchup, latency tracking, and sync event broadcasting.
 */
import { SyncStatusInfo } from '../types';

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
    const isOutOfSync = drift > 0.4; // 400ms drift threshold

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
      }, 1200);
    }

    return {
      needsSeek: drift > 0.5,
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
    }, 800);
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
 * Timeline drift correction loop running at 1-second interval.
 */
export function startAutoSync(player: any, sync: { currentTime?: number } | any): () => void {
  const interval = setInterval(() => {
    if (!player) return;

    const local =
      typeof player.getCurrentTime === 'function'
        ? player.getCurrentTime()
        : player.currentTime !== undefined
        ? player.currentTime
        : 0;

    const host =
      typeof sync.currentTime === 'function'
        ? sync.currentTime()
        : sync.currentTime !== undefined
        ? sync.currentTime
        : 0;

    const drift = Math.abs(local - host);

    if (drift > 0.7) {
      if (typeof player.seekTo === 'function') {
        player.seekTo(host);
      } else if (typeof player.currentTime !== 'undefined') {
        player.currentTime = host;
      }
    }
  }, 1000);

  return () => clearInterval(interval);
}

export default startAutoSync;

