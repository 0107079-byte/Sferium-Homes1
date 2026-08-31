import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { syncVideoServer, ClientConnection } from './backend/syncVideoServer';
import { roomManager } from './backend/modules/rooms';
import { ChatMessage, User, VideoInfo } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

// API Routes
app.get('/api/rooms', (_req: Request, res: Response) => {
  res.json(roomManager.listRooms());
});

app.get('/api/rooms/:id', (req: Request, res: Response) => {
  const roomId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const room = roomManager.getRoom(roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json(room);
});

app.post('/api/rooms', (req: Request, res: Response) => {
  const { id, name, hostId, accessCode, isPrivate } = req.body;
  const newRoom = roomManager.createRoom({
    id: id || `room-${Date.now()}`,
    name: name || 'Новая комната Sferium',
    hostId: hostId || 'host',
    currentVideo: {
      provider: 'youtube',
      id: 'dQw4w9WgXcQ',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Rick Astley - Never Gonna Give You Up',
    },
    playbackState: {
      position: 0,
      playing: false,
      playbackRate: 1.0,
      revision: 1,
      updatedAt: Date.now(),
    },
    users: [],
    createdAt: Date.now(),
    accessCode,
    isPrivate: !!isPrivate,
  });
  res.status(201).json(newRoom);
});

app.post('/api/rooms/:id/video', (req: Request, res: Response) => {
  const roomId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { video } = req.body as { video: VideoInfo };
  const updated = roomManager.setVideo(roomId, video);
  if (!updated) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  syncVideoServer.resetRoomVideo(roomId);
  // Broadcast video update event to all room participants
  broadcastToRoom(roomId, {
    type: 'ROOM_VIDEO_CHANGED',
    roomId,
    video,
  });
  res.json(updated);
});

// WebSocket Handling
const clients = new Map<WebSocket, ClientConnection>();

function broadcastToRoom(roomId: string, message: any, excludeWs?: WebSocket) {
  const msgStr = JSON.stringify(message);
  for (const [ws, client] of clients.entries()) {
    if (client.roomId === roomId && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(msgStr);
    }
  }
}

wss.on('connection', (ws: WebSocket) => {
  let clientInfo: ClientConnection | null = null;

  ws.on('message', (messageRaw: string) => {
    try {
      const data = JSON.parse(messageRaw.toString());
      if (!data || typeof data !== 'object') return;

      // 1. CANONICAL VIDEO SYNC MESSAGES
      if (data.type === 'SYNC_COMMAND' || data.type === 'SYNC_REQUEST') {
        if (clientInfo) {
          syncVideoServer.handleMessage(clientInfo, data);
        }
        return;
      }

      // 2. ROOM JOIN & REGISTRATION
      if (data.type === 'JOIN_ROOM') {
        const { roomId, user } = data as { roomId: string; user: User };
        clientInfo = {
          ws,
          userId: user.id,
          roomId,
          role: user.role || 'guest',
        };
        clients.set(ws, clientInfo);
        syncVideoServer.registerClient(clientInfo);

        roomManager.addUser(roomId, user);

        // Notify other participants
        broadcastToRoom(roomId, {
          type: 'USER_JOINED',
          roomId,
          user,
        }, ws);

        // Send current authoritative playback state immediately
        syncVideoServer.processSyncRequest(clientInfo);
        return;
      }

      // 3. CHAT MESSAGES
      if (data.type === 'CHAT_MESSAGE') {
        const chatMsg = data.message as ChatMessage;
        broadcastToRoom(chatMsg.roomId, {
          type: 'CHAT_MESSAGE',
          message: chatMsg,
        });
        return;
      }

      // 4. USER STATUS UPDATES (VAD, Mute, Camera)
      if (data.type === 'USER_STATUS') {
        if (clientInfo) {
          broadcastToRoom(clientInfo.roomId, {
            type: 'USER_STATUS',
            userId: clientInfo.userId,
            status: data.status,
          }, ws);
        }
        return;
      }

      // 5. P2P WebRTC VOICE/VIDEO SIGNALING (Mesh audio/video, strictly without video sync)
      if (data.type === 'SIGNAL_OFFER' || data.type === 'SIGNAL_ANSWER' || data.type === 'SIGNAL_ICE') {
        const targetUserId = data.targetUserId;
        for (const [targetWs, client] of clients.entries()) {
          if (client.userId === targetUserId && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify({
              type: data.type,
              fromUserId: clientInfo?.userId,
              signal: data.signal,
            }));
            break;
          }
        }
        return;
      }

      // 6. ROLE UPDATE
      if (data.type === 'UPDATE_ROLE' && clientInfo) {
        clientInfo.role = data.role;
        broadcastToRoom(clientInfo.roomId, {
          type: 'USER_ROLE_UPDATED',
          userId: data.targetUserId,
          role: data.role,
        });
        return;
      }
    } catch (err) {
      console.error('[WebSocket] Message error:', err);
    }
  });

  ws.on('close', () => {
    if (clientInfo) {
      syncVideoServer.unregisterClient(clientInfo);
      clients.delete(ws);
      roomManager.removeUser(clientInfo.roomId, clientInfo.userId);
      broadcastToRoom(clientInfo.roomId, {
        type: 'USER_LEFT',
        roomId: clientInfo.roomId,
        userId: clientInfo.userId,
      });
    }
  });
});

// Setup Vite dev server or serve static files in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const PORT = 3000;

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Homes Sync] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

export { app, server };
