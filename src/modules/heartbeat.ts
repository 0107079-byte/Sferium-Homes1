/**
 * Heartbeat Synchronization Module for Sferium Homes
 * Ensures hard binding between Remote Control (Master) and Player (Slave)
 */

export interface HeartbeatPayload {
  roomId: string;
  senderId: string;
  time: number;
  currentTime: number;
  state: 'playing' | 'paused';
  isPlaying: boolean;
  playbackRate: number;
  timestamp: number;
}

export type HeartbeatCallback = (payload: HeartbeatPayload) => void;

export class HeartbeatManager {
  private intervalId: any = null;
  private intervalMs: number = 750; // 500-1000ms
  private isMaster: boolean = false;
  private masterTimeGetter: (() => { currentTime: number; isPlaying: boolean; playbackRate?: number }) | null = null;
  private onBroadcastCallback: HeartbeatCallback | null = null;

  constructor(intervalMs: number = 750) {
    this.intervalMs = intervalMs;
  }

  /**
   * Start master heartbeat ticking from Remote Control
   */
  public startMasterHeartbeat(
    roomId: string,
    senderId: string,
    getter: () => { currentTime: number; isPlaying: boolean; playbackRate?: number },
    onBroadcast: HeartbeatCallback
  ) {
    this.stopMasterHeartbeat();
    this.isMaster = true;
    this.masterTimeGetter = getter;
    this.onBroadcastCallback = onBroadcast;

    // Send first heartbeat immediately
    this.tickMaster(roomId, senderId);

    this.intervalId = setInterval(() => {
      this.tickMaster(roomId, senderId);
    }, this.intervalMs);
  }

  private tickMaster(roomId: string, senderId: string) {
    if (!this.isMaster || !this.masterTimeGetter || !this.onBroadcastCallback) return;

    try {
      const { currentTime, isPlaying, playbackRate = 1 } = this.masterTimeGetter();
      const payload: HeartbeatPayload = {
        roomId,
        senderId,
        time: currentTime,
        currentTime,
        state: isPlaying ? 'playing' : 'paused',
        isPlaying,
        playbackRate,
        timestamp: Date.now(),
      };
      this.onBroadcastCallback(payload);
    } catch (err) {
      console.warn('[HeartbeatManager] tick error:', err);
    }
  }

  public stopMasterHeartbeat() {
    this.isMaster = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public isActive(): boolean {
    return this.isMaster && this.intervalId !== null;
  }
}

export const heartbeatManager = new HeartbeatManager(750);
