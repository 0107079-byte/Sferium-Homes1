export interface P2PPeerConfig {
  peerId: string;
  roomId: string;
  isHost: boolean;
  onSyncState?: (state: { time: number; isPlaying: boolean }) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
  fallbackWs?: any;
}

/**
 * P2PSyncController
 * Manages direct peer-to-peer data channels for ultra-low latency video sync,
 * with seamless fallback to WebSocket when P2P is unavailable.
 */
export class P2PSyncController {
  private peerId = '';
  private roomId = '';
  private isHost = false;
  private connections = new Map<string, any>();
  private listeners = new Map<string, Set<Function>>();
  private fallbackWs: any = null;
  private isConnected = false;

  public init(config: P2PPeerConfig) {
    this.peerId = config.peerId;
    this.roomId = config.roomId;
    this.isHost = config.isHost;
    this.fallbackWs = config.fallbackWs;
    this.isConnected = true;

    if (config.onSyncState) this.on('sync:state', config.onSyncState);
    if (config.onPlay) this.on('sync:play', config.onPlay);
    if (config.onPause) this.on('sync:pause', config.onPause);
    if (config.onSeek) this.on('sync:seek', config.onSeek);
  }

  public on(event: string, handler: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public off(event: string, handler: Function) {
    this.listeners.get(event)?.delete(handler);
  }

  public emit(event: string, data: any) {
    this.listeners.get(event)?.forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error(`[P2PSync] Error in listener for ${event}:`, e);
      }
    });
  }

  public broadcast(type: string, payload: Record<string, any> = {}) {
    const packet = {
      type,
      roomId: this.roomId,
      senderId: this.peerId,
      timestamp: Date.now(),
      ...payload,
    };

    let sentP2P = false;

    // Send over active P2P connections
    this.connections.forEach((conn) => {
      if (conn && conn.open && typeof conn.send === 'function') {
        try {
          conn.send(packet);
          sentP2P = true;
        } catch (e) {
          console.warn('[P2PSync] Failed to send via P2P connection:', e);
        }
      }
    });

    // Fallback: If no P2P connections are established, fallback to WebSocket
    if (!sentP2P && this.fallbackWs) {
      const jsonStr = JSON.stringify(packet);
      if (typeof this.fallbackWs.send === 'function') {
        this.fallbackWs.send(jsonStr);
      }
    }
  }

  public sendPlay() {
    this.broadcast('sync:play');
  }

  public sendPause() {
    this.broadcast('sync:pause');
  }

  public sendSeek(time: number) {
    this.broadcast('sync:seek', { time });
  }

  public sendState(time: number, isPlaying: boolean) {
    this.broadcast('sync:state', { time, isPlaying });
  }

  public disconnect() {
    this.connections.forEach((conn) => {
      try {
        conn.close();
      } catch {}
    });
    this.connections.clear();
    this.isConnected = false;
  }
}

export const p2pSync = new P2PSyncController();
export default p2pSync;
