export interface P2PPeerConfig {
  peerId: string;
  roomId: string;
  isHost: boolean;
  onSyncState?: (state: { position: number; playing: boolean }) => void;
  onSyncCommand?: (command: { command: string; position?: number }) => void;
  fallbackWs?: any;
}

/**
 * P2PSyncController
 * Direct peer-to-peer data channel synchronization using the single authoritative protocol:
 * SYNC_COMMAND, SYNC_STATE, SYNC_REQUEST.
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

    if (config.onSyncState) this.on('SYNC_STATE', config.onSyncState);
    if (config.onSyncCommand) this.on('SYNC_COMMAND', config.onSyncCommand);
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

  public broadcast(type: 'SYNC_COMMAND' | 'SYNC_STATE' | 'SYNC_REQUEST', payload: Record<string, any> = {}) {
    const packet = {
      type,
      roomId: this.roomId,
      senderId: this.peerId,
      timestamp: Date.now(),
      ...payload,
    };

    // Send over active P2P connections
    this.connections.forEach((conn) => {
      if (conn && conn.open && typeof conn.send === 'function') {
        try {
          conn.send(packet);
        } catch (e) {
          console.warn('[P2PSync] Failed to send via P2P connection:', e);
        }
      }
    });
  }

  public sendPlay(time?: number) {
    this.broadcast('SYNC_COMMAND', { command: 'play', position: time });
  }

  public sendPause(time?: number) {
    this.broadcast('SYNC_COMMAND', { command: 'pause', position: time });
  }

  public sendSeek(position: number) {
    this.broadcast('SYNC_COMMAND', { command: 'seek', position });
  }

  public sendState(position: number, playing: boolean) {
    this.broadcast('SYNC_STATE', { position, playing });
  }

  public requestSync() {
    this.broadcast('SYNC_REQUEST', {});
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
