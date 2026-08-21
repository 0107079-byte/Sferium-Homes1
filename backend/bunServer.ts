import { handleSyncMessage } from "./syncVideoServer";

export interface BunClientData {
  userId: string;
  name?: string;
  roomId: string;
  isHost?: boolean;
}

export interface BunRoom {
  id: string;
  hostId: string;
  videoState?: {
    url: string;
    time: number;
    isPlaying: boolean;
    updatedAt: number;
    hostId: string;
  };
  clients: Set<any>;
}

const rooms = new Map<string, BunRoom>();

function getOrCreateRoom(roomId: string, hostId: string): BunRoom {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      hostId,
      videoState: {
        url: "",
        time: 0,
        isPlaying: false,
        updatedAt: Date.now(),
        hostId,
      },
      clients: new Set(),
    };
    rooms.set(roomId, room);
  }
  return room;
}

function broadcastToRoom(roomId: string, data: any) {
  const room = rooms.get(roomId);
  if (!room) return;
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  for (const client of room.clients) {
    try {
      client.send(payload);
    } catch (e) {
      console.warn("[BunServer] Broadcast error:", e);
    }
  }
}

/**
 * Bun WebSocket Server Configuration
 * Compatible with `bun run backend/bunServer.ts`
 */
export const bunServerConfig = {
  port: 3000,
  fetch(req: Request, server: any) {
    const url = new URL(req.url);

    if (url.pathname === "/ws" || url.pathname === "/api/ws") {
      const upgraded = server.upgrade(req, {
        data: {
          userId: url.searchParams.get("userId") || `user_${Date.now()}`,
          roomId: url.searchParams.get("roomId") || "CINEMA",
          name: url.searchParams.get("name") || "Гость",
        },
      });
      if (upgraded) return undefined;
    }

    return new Response("Sferium Watch Party Bun Server Running", { status: 200 });
  },
  websocket: {
    open(ws: any) {
      const { roomId, userId } = ws.data;
      const room = getOrCreateRoom(roomId, userId);
      room.clients.add(ws);

      // Send initial room state
      ws.send(
        JSON.stringify({
          type: "room_state",
          roomId,
          videoState: room.videoState,
        })
      );
    },
    message(ws: any, message: string | Buffer) {
      try {
        const msg = JSON.parse(message.toString());
        const { roomId, userId } = ws.data;
        const room = rooms.get(roomId);

        if (!room) return;

        if (typeof msg.type === "string" && msg.type.startsWith("sync:")) {
          handleSyncMessage(
            msg,
            { id: userId, userId, isHost: room.hostId === userId },
            room,
            (targetRoomId, payload) => broadcastToRoom(targetRoomId, payload)
          );
          return;
        }

        // Standard broadcast fallback
        broadcastToRoom(roomId, msg);
      } catch (err) {
        console.error("[BunServer] Message parsing error:", err);
      }
    },
    close(ws: any) {
      const { roomId } = ws.data;
      const room = rooms.get(roomId);
      if (room) {
        room.clients.delete(ws);
        if (room.clients.size === 0) {
          rooms.delete(roomId);
        }
      }
    },
  },
};

export default bunServerConfig;
