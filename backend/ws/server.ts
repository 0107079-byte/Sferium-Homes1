import { handleSyncMessage } from "../syncVideoServer";

export interface SferiumRoomState {
  id: string;
  videoUrl: string;
  currentTime: number;
  isPlaying: boolean;
  lastUpdated: number;
  hostId: string;
  videoState?: {
    url: string;
    time: number;
    isPlaying: boolean;
    updatedAt: number;
    hostId: string;
  };
  members: Record<string, any>;
}

export interface RedisClientInterface {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ...args: any[]) => Promise<any>;
}

/**
 * Sferium-Homes WebSocket Backend Integration Handler
 * Supports in-memory state & optional Redis persistence.
 */
export class SferiumWsServer {
  private rooms = new Map<string, SferiumRoomState>();
  private redis: RedisClientInterface | null = null;

  constructor(redisClient?: RedisClientInterface) {
    this.redis = redisClient || null;
  }

  public async getRoom(roomId: string, defaultHostId?: string): Promise<SferiumRoomState> {
    if (this.redis) {
      try {
        const cached = await this.redis.get(`sferium:room:${roomId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          this.rooms.set(roomId, parsed);
          return parsed;
        }
      } catch (e) {
        console.warn("[SferiumWsServer] Redis read error:", e);
      }
    }

    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        videoUrl: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
        currentTime: 0,
        isPlaying: false,
        lastUpdated: Date.now(),
        hostId: defaultHostId || "host",
        videoState: {
          url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
          time: 0,
          isPlaying: false,
          updatedAt: Date.now(),
          hostId: defaultHostId || "host",
        },
        members: {},
      };
      this.rooms.set(roomId, room);
    }
    return room;
  }

  public async saveRoom(room: SferiumRoomState) {
    this.rooms.set(room.id, room);
    if (this.redis) {
      try {
        await this.redis.set(`sferium:room:${room.id}`, JSON.stringify(room), "EX", 86400);
      } catch (e) {
        console.warn("[SferiumWsServer] Redis save error:", e);
      }
    }
  }

  public async onWebSocketMessage(
    msg: any,
    client: { userId: string; roomId: string; isHost?: boolean },
    broadcast: (roomId: string, data: any) => void
  ) {
    const room = await this.getRoom(client.roomId, client.userId);

    // Process video synchronization packets (sync:play, sync:pause, sync:seek, sync:state)
    if (typeof msg.type === "string" && msg.type.startsWith("sync:")) {
      handleSyncMessage(
        msg,
        { id: client.userId, userId: client.userId, isHost: client.isHost ?? (room.hostId === client.userId) },
        room,
        (targetRoomId, payload) => {
          broadcast(targetRoomId, payload);
        }
      );
      await this.saveRoom(room);
      return;
    }
  }
}

export const sferiumWsServer = new SferiumWsServer();
export default sferiumWsServer;
