import { IVideoAdapter } from '../lib/VideoAdapter';
import { SyncCommandMessage, SyncCommandType, SyncRequestMessage, SyncStateMessage } from '../types';

export interface SyncControllerOptions {
  roomId: string;
  userId: string;
  isHost?: boolean;
  canControl?: boolean;
  onSendMessage: (msg: SyncCommandMessage | SyncRequestMessage) => void;
  onStateApplied?: (state: SyncStateMessage) => void;
  onDriftCorrected?: (drift: number, type: 'seek' | 'rate' | 'none') => void;
}

/**
 * SyncController - Single authoritative client-side video synchronization engine.
 *
 * PROTOCOL:
 * - Emits SYNC_COMMAND (play, pause, seek, rate) to server when user interacts (if permitted).
 * - Emits SYNC_REQUEST when joining/requesting authoritative state.
 * - Receives authoritative SYNC_STATE from server:
 *   - Monotonic revision check: ignores if revision <= lastAppliedRevision
 *   - Calculates expected position using serverTime and playbackRate
 *   - Smooth drift correction via rate micro-adjustments (<1.5s) or precision seek (>=1.5s)
 *   - Prevents feedback loops via isApplyingState lock
 */
export class SyncController {
  private adapter: IVideoAdapter | null = null;
  private options: SyncControllerOptions;
  private lastAppliedRevision = -1;
  private isApplyingState = false;
  private isDestroyed = false;
  private driftCheckInterval: any = null;
  private lastKnownAuthoritativeState: SyncStateMessage | null = null;
  private timeOffset = 0; // estimate of clientTime - serverTime

  constructor(options: SyncControllerOptions) {
    this.options = options;
  }

  public setAdapter(adapter: IVideoAdapter | null): void {
    if (this.adapter === adapter) return;
    this.adapter = adapter;

    if (this.adapter) {
      this.bindAdapterEvents();
      this.requestInitialSync();
      this.startPeriodicDriftMonitor();
    } else {
      this.stopPeriodicDriftMonitor();
    }
  }

  public updatePermissions(canControl: boolean, isHost?: boolean): void {
    this.options.canControl = canControl;
    if (isHost !== undefined) {
      this.options.isHost = isHost;
    }
  }

  /**
   * Request current authoritative playback state from server.
   */
  public requestInitialSync(): void {
    if (this.isDestroyed) return;
    const req: SyncRequestMessage = {
      type: 'SYNC_REQUEST',
      roomId: this.options.roomId,
      userId: this.options.userId,
    };
    this.options.onSendMessage(req);
  }

  /**
   * User interaction commands (Play, Pause, Seek, Rate).
   * Strictly dispatches SYNC_COMMAND to the server authority.
   */
  public handleUserCommand(command: SyncCommandType, position?: number, rate?: number): void {
    if (!this.options.canControl && !this.options.isHost) {
      return;
    }
    if (this.isApplyingState) {
      return;
    }

    const currentPos = position !== undefined 
      ? position 
      : (this.adapter ? this.adapter.getCurrentTime() : 0);

    const currentRate = rate !== undefined 
      ? rate 
      : (this.adapter ? this.adapter.getPlaybackRate() : 1.0);

    const msg: SyncCommandMessage = {
      type: 'SYNC_COMMAND',
      roomId: this.options.roomId,
      command,
      position: Math.max(0, currentPos),
      playbackRate: currentRate,
      clientTime: Date.now(),
      userId: this.options.userId,
    };

    this.options.onSendMessage(msg);
  }

  /**
   * Receives incoming SYNC_STATE broadcast from server.
   */
  public applySyncState(state: SyncStateMessage): void {
    if (this.isDestroyed || !this.adapter) {
      this.lastKnownAuthoritativeState = state;
      return;
    }

    // Monotonic revision check: discard stale states
    if (state.revision <= this.lastAppliedRevision) {
      return;
    }

    this.lastAppliedRevision = state.revision;
    this.lastKnownAuthoritativeState = state;
    this.timeOffset = Date.now() - state.serverTime;

    this.isApplyingState = true;

    try {
      // Calculate authoritative expected position
      const now = Date.now();
      const elapsedSeconds = state.playing 
        ? Math.max(0, (now - state.serverTime) / 1000) * state.playbackRate 
        : 0;
      const expectedPosition = state.position + elapsedSeconds;

      const currentPosition = this.adapter.getCurrentTime();
      const isCurrentlyPlaying = this.adapter.isPlaying();
      const currentRate = this.adapter.getPlaybackRate();

      const drift = currentPosition - expectedPosition;
      const absDrift = Math.abs(drift);

      // 1. Synchronize Play / Pause state
      if (state.playing && !isCurrentlyPlaying) {
        this.adapter.play();
      } else if (!state.playing && isCurrentlyPlaying) {
        this.adapter.pause();
      }

      // 2. Synchronize Playback Rate
      if (Math.abs(currentRate - state.playbackRate) > 0.01) {
        this.adapter.setPlaybackRate(state.playbackRate);
      }

      // 3. Drift Correction
      if (absDrift >= 1.5) {
        // Hard correction via Seek
        this.adapter.seekTo(Math.max(0, expectedPosition));
        this.options.onDriftCorrected?.(absDrift, 'seek');
      } else if (absDrift >= 0.15 && state.playing) {
        // Soft correction via micro rate adjustment
        const rateMultiplier = expectedPosition > currentPosition ? 1.05 : 0.95;
        this.adapter.setPlaybackRate(state.playbackRate * rateMultiplier);
        this.options.onDriftCorrected?.(absDrift, 'rate');
      } else {
        this.options.onDriftCorrected?.(absDrift, 'none');
      }

      this.options.onStateApplied?.(state);
    } catch (err) {
      console.error('[SyncController] Error applying SYNC_STATE:', err);
    } finally {
      this.isApplyingState = false;
    }
  }

  private bindAdapterEvents(): void {
    if (!this.adapter) return;

    this.adapter.setEventListeners({
      onPlay: () => {
        if (!this.isApplyingState && (this.options.canControl || this.options.isHost)) {
          this.handleUserCommand('play');
        }
      },
      onPause: () => {
        if (!this.isApplyingState && (this.options.canControl || this.options.isHost)) {
          this.handleUserCommand('pause');
        }
      },
      onSeek: (pos) => {
        if (!this.isApplyingState && (this.options.canControl || this.options.isHost)) {
          this.handleUserCommand('seek', pos);
        }
      },
      onRateChange: (rate) => {
        if (!this.isApplyingState && (this.options.canControl || this.options.isHost)) {
          this.handleUserCommand('rate', undefined, rate);
        }
      },
    });
  }

  private startPeriodicDriftMonitor(): void {
    this.stopPeriodicDriftMonitor();
    this.driftCheckInterval = setInterval(() => {
      this.checkAndCorrectDrift();
    }, 2000);
  }

  private stopPeriodicDriftMonitor(): void {
    if (this.driftCheckInterval) {
      clearInterval(this.driftCheckInterval);
      this.driftCheckInterval = null;
    }
  }

  private checkAndCorrectDrift(): void {
    if (!this.adapter || !this.lastKnownAuthoritativeState || this.isApplyingState) {
      return;
    }

    const state = this.lastKnownAuthoritativeState;
    if (!state.playing) return;

    const now = Date.now();
    const elapsedSeconds = Math.max(0, (now - state.serverTime) / 1000) * state.playbackRate;
    const expectedPosition = state.position + elapsedSeconds;
    const currentPosition = this.adapter.getCurrentTime();
    const absDrift = Math.abs(currentPosition - expectedPosition);

    if (absDrift >= 2.0) {
      this.isApplyingState = true;
      this.adapter.seekTo(expectedPosition);
      this.options.onDriftCorrected?.(absDrift, 'seek');
      setTimeout(() => {
        this.isApplyingState = false;
      }, 150);
    } else if (absDrift >= 0.25) {
      const rateMultiplier = expectedPosition > currentPosition ? 1.05 : 0.95;
      this.adapter.setPlaybackRate(state.playbackRate * rateMultiplier);
      this.options.onDriftCorrected?.(absDrift, 'rate');
    } else {
      // Drift is negligible, ensure standard playback rate
      if (Math.abs(this.adapter.getPlaybackRate() - state.playbackRate) > 0.02) {
        this.adapter.setPlaybackRate(state.playbackRate);
      }
      this.options.onDriftCorrected?.(absDrift, 'none');
    }
  }

  public getLastRevision(): number {
    return this.lastAppliedRevision;
  }

  public getLastKnownState(): SyncStateMessage | null {
    return this.lastKnownAuthoritativeState;
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.stopPeriodicDriftMonitor();
    this.adapter = null;
  }
}
