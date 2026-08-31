import { WebSocket } from 'ws';
import { SyncCommandMessage, SyncRequestMessage, SyncStateMessage } from '../src/types';

export interface AuthoritativePlaybackState {
  position: number;
  playing: boolean;
  playbackRate: number;
  revision: number;
  updatedAt: number;
}

export interface ClientConnection {
  ws: WebSocket;
  userId: string;
  roomId: string;
  role: 'host' | 'moderator' | 'member' | 'guest';
}

export class AuthoritativeSyncServer {
  private roomStates = new Map<string, AuthoritativePlaybackState>();
  private roomClients = new Map<string, Set<ClientConnection>>();

  /**
   * Get or initialize authoritative state for a room.
   */
  public getRoomState(roomId: string): AuthoritativePlaybackState {
    let state = this.roomStates.get(roomId);
    if (!state) {
      state = {
        position: 0,
        playing: false,
        playbackRate: 1.0,
        revision: 0,
        updatedAt: Date.now(),
      };
      this.roomStates.set(roomId, state);
    }
    return state;
  }

  /**
   * Calculate current instantaneous position based on server clock.
   */
  public calculateCurrentPosition(state: AuthoritativePlaybackState): number {
    if (!state.playing) {
      return state.position;
    }
    const elapsed = Math.max(0, (Date.now() - state.updatedAt) / 1000) * state.playbackRate;
    return state.position + elapsed;
  }

  /**
   * Register a client connection to a room.
   */
  public registerClient(client: ClientConnection): void {
    let clients = this.roomClients.get(client.roomId);
    if (!clients) {
      clients = new Set();
      this.roomClients.set(client.roomId, clients);
    }
    clients.add(client);
  }

  /**
   * Unregister a client connection.
   */
  public unregisterClient(client: ClientConnection): void {
    const clients = this.roomClients.get(client.roomId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.roomClients.delete(client.roomId);
      }
    }
  }

  /**
   * Handle incoming WebSocket messages strictly according to the canonical protocol.
   * Only SYNC_COMMAND and SYNC_REQUEST are processed for video sync.
   */
  public handleMessage(client: ClientConnection, data: any): void {
    if (!data || typeof data !== 'object') return;

    // Reject attempt to send SYNC_STATE as a control command
    if (data.type === 'SYNC_STATE') {
      console.warn(`[AuthoritativeSyncServer] Rejected invalid SYNC_STATE sent by client ${client.userId}`);
      return;
    }

    if (data.type === 'SYNC_COMMAND') {
      this.processSyncCommand(client, data as SyncCommandMessage);
    } else if (data.type === 'SYNC_REQUEST') {
      this.processSyncRequest(client, data as SyncRequestMessage);
    }
  }

  /**
   * Handle SYNC_COMMAND:
   * 1. Validate permissions
   * 2. Update authoritative room state
   * 3. revision++
   * 4. Broadcast authoritative SYNC_STATE to ALL room clients
   */
  public processSyncCommand(client: ClientConnection, msg: SyncCommandMessage): void {
    const roomId = client.roomId;
    // Validate permission (Host, Moderator, or Member if unlocked)
    if (client.role === 'guest') {
      console.warn(`[AuthoritativeSyncServer] Permission denied for guest ${client.userId} in room ${roomId}`);
      return;
    }

    const state = this.getRoomState(roomId);
    const now = Date.now();
    const currentCalculatedPos = this.calculateCurrentPosition(state);

    switch (msg.command) {
      case 'play': {
        state.position = msg.position !== undefined ? Math.max(0, msg.position) : currentCalculatedPos;
        state.playing = true;
        state.playbackRate = msg.playbackRate || state.playbackRate || 1.0;
        state.updatedAt = now;
        state.revision += 1;
        break;
      }
      case 'pause': {
        state.position = msg.position !== undefined ? Math.max(0, msg.position) : currentCalculatedPos;
        state.playing = false;
        state.updatedAt = now;
        state.revision += 1;
        break;
      }
      case 'seek': {
        state.position = msg.position !== undefined ? Math.max(0, msg.position) : 0;
        state.updatedAt = now;
        state.revision += 1;
        break;
      }
      case 'rate': {
        state.position = currentCalculatedPos;
        state.playbackRate = msg.playbackRate && msg.playbackRate > 0 ? msg.playbackRate : 1.0;
        state.updatedAt = now;
        state.revision += 1;
        break;
      }
      default:
        console.warn(`[AuthoritativeSyncServer] Unknown SYNC_COMMAND command: ${(msg as any).command}`);
        return;
    }

    // Broadcast authoritative SYNC_STATE to ALL clients in the room
    this.broadcastSyncState(roomId);
  }

  /**
   * Handle SYNC_REQUEST:
   * Returns current authoritative state to the requesting client without modifying room state.
   */
  public processSyncRequest(client: ClientConnection, _msg?: SyncRequestMessage): void {
    const state = this.getRoomState(client.roomId);
    const currentPos = this.calculateCurrentPosition(state);
    const now = Date.now();

    const responseState: SyncStateMessage = {
      type: 'SYNC_STATE',
      roomId: client.roomId,
      position: currentPos,
      playing: state.playing,
      playbackRate: state.playbackRate,
      revision: state.revision,
      serverTime: now,
    };

    if (client.ws && (client.ws.readyState === 1 || client.ws.readyState === (WebSocket as any)?.OPEN)) {
      client.ws.send(JSON.stringify(responseState));
    }
  }

  /**
   * Broadcast authoritative SYNC_STATE to all connected clients in a room.
   */
  public broadcastSyncState(roomId: string): void {
    const state = this.getRoomState(roomId);
    const clients = this.roomClients.get(roomId);
    if (!clients || clients.size === 0) return;

    const now = Date.now();
    const payload: SyncStateMessage = {
      type: 'SYNC_STATE',
      roomId,
      position: state.position,
      playing: state.playing,
      playbackRate: state.playbackRate,
      revision: state.revision,
      serverTime: now,
    };

    const messageStr = JSON.stringify(payload);
    for (const client of clients) {
      if (client.ws && (client.ws.readyState === 1 || client.ws.readyState === (WebSocket as any)?.OPEN)) {
        client.ws.send(messageStr);
      }
    }
  }

  /**
   * Reset room state (e.g., when switching video)
   */
  public resetRoomVideo(roomId: string): void {
    const state = this.getRoomState(roomId);
    state.position = 0;
    state.playing = false;
    state.playbackRate = 1.0;
    state.revision += 1;
    state.updatedAt = Date.now();
    this.broadcastSyncState(roomId);
  }
}

export const syncVideoServer = new AuthoritativeSyncServer();
