/**
 * WebSocket Server for Room Management, Host Controls, Hard-Sync & WebRTC Mesh Voice
 * (ws/server.ts)
 * 
 * Events Handled:
 * Client -> Server:
 *   - room:join
 *   - room:leave
 *   - room:kick
 *   - room:mute
 *   - room:close
 *   - room:hostAction
 * 
 * Server -> Client:
 *   - room:newHost
 *   - room:userKicked
 *   - room:userMuted
 *   - room:closed
 *   - room:updateParticipants
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import {
  rooms,
  getRoom,
  joinRoom,
  leaveRoom,
  kickUser,
  muteUser,
  startBroadcast,
  closeRoom,
  transferHost,
  getParticipants,
  parseRoomId,
} from '../backend/rooms';
import { VoicePeer } from '../src/types';

export interface ClientConnection {
  ws: WebSocket;
  userId: string;
  roomId: string;
  name: string;
  avatar?: string;
  color?: string;
  isAlive: boolean;
}

export class SignalingServer {
  public wss: WebSocketServer | null = null;
  public connections: Map<WebSocket, ClientConnection> = new Map();
  public voiceRooms: Map<string, Map<string, VoicePeer>> = new Map();

  public init(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const urlParams = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`).searchParams;
      const rawRoomId = urlParams.get('roomId') || 'CINEMA';
      const roomId = parseRoomId(rawRoomId);
      const userId = urlParams.get('userId') || `user_${Math.random().toString(36).substring(2, 9)}`;
      const name = urlParams.get('name') || 'Гость';
      const avatar = urlParams.get('avatar') || '🍿';
      const color = urlParams.get('color') || '#6366f1';

      const conn: ClientConnection = {
        ws,
        userId,
        roomId,
        name,
        avatar,
        color,
        isAlive: true,
      };

      this.connections.set(ws, conn);

      ws.on('pong', () => {
        conn.isAlive = true;
      });

      ws.on('message', async (rawData: string) => {
        try {
          const msg = JSON.parse(rawData.toString());
          await this.handleMessage(conn, msg);
        } catch (e) {
          console.error('[SignalingServer] Invalid JSON:', e);
        }
      });

      ws.on('close', async () => {
        await this.handleDisconnect(conn);
      });

      ws.on('error', (err) => {
        console.warn('[SignalingServer] WebSocket error:', err);
      });

      // Auto-join if roomId and userId exist in query
      if (roomId && userId) {
        this.handleRoomJoin(conn, { roomId, userId, name, avatar, color });
      }
    });

    // Heartbeat ping/pong interval
    const interval = setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((ws: WebSocket) => {
        const client = ws as any;
        if (client.isAlive === false) return ws.terminate();
        client.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });

    console.log('[SignalingServer] Room Management & Signaling Server initialized on /ws');
  }

  /**
   * Handle incoming WebSocket message
   */
  public async handleMessage(conn: ClientConnection, msg: any) {
    const { type, roomId, userId } = msg;
    const targetRoomId = parseRoomId(roomId || conn.roomId);
    const targetUserId = userId || conn.userId;

    switch (type) {
      // =====================================
      // 1. ROOM LIFECYCLE & PARTICIPANT EVENTS
      // =====================================

      case 'room:join':
      case 'join':
      case 'join_room': {
        await this.handleRoomJoin(conn, msg);
        break;
      }

      case 'room:leave':
      case 'leave':
      case 'exit_room': {
        await this.handleRoomLeave(conn);
        break;
      }

      case 'room:kick':
      case 'kick_user':
      case 'member:kick': {
        const targetToKick = msg.targetUserId || msg.userId;
        const reason = msg.reason || 'Исключен создателем комнаты';
        const result = await kickUser(targetRoomId, targetToKick, conn.userId, reason);

        if (!result.success) {
          this.send(conn.ws, {
            type: 'error',
            message: result.error || 'Не удалось исключить участника',
          });
          return;
        }

        // Notify kicked user directly and close socket
        this.sendToUserInRoom(targetRoomId, targetToKick, {
          type: 'room:userKicked',
          roomId: targetRoomId,
          targetUserId: targetToKick,
          kickedBy: conn.userId,
          reason,
        });

        // Close connection for kicked user
        this.connections.forEach((c, s) => {
          if (c.roomId === targetRoomId && c.userId === targetToKick) {
            try {
              s.close(4001, 'Kicked by host');
            } catch {}
          }
        });

        // Notify room
        this.broadcastToRoom(targetRoomId, {
          type: 'room:userKicked',
          roomId: targetRoomId,
          targetUserId: targetToKick,
          kickedBy: conn.userId,
          reason,
        });

        this.broadcastParticipantsUpdate(targetRoomId);
        break;
      }

      case 'room:mute':
      case 'voice:mod_mute': {
        const targetToMute = msg.targetUserId || msg.userId;
        const isMuted = msg.isMuted !== undefined ? Boolean(msg.isMuted) : true;
        const result = await muteUser(targetRoomId, targetToMute, conn.userId, isMuted);

        if (!result.success) {
          this.send(conn.ws, {
            type: 'error',
            message: result.error || 'Не удалось выключить микрофон',
          });
          return;
        }

        // Send direct command to target
        this.sendToUserInRoom(targetRoomId, targetToMute, {
          type: 'room:userMuted',
          roomId: targetRoomId,
          targetUserId: targetToMute,
          isMuted,
          mutedBy: conn.name,
        });

        // Also broadcast to room
        this.broadcastToRoom(targetRoomId, {
          type: 'room:userMuted',
          roomId: targetRoomId,
          targetUserId: targetToMute,
          isMuted,
          mutedBy: conn.name,
        });

        this.broadcastParticipantsUpdate(targetRoomId);
        break;
      }

      case 'room:close':
      case 'close_room':
      case 'rooms:delete': {
        const result = await closeRoom(targetRoomId, conn.userId);
        if (!result.success) {
          this.send(conn.ws, {
            type: 'error',
            message: result.error || 'Не удалось закрыть комнату',
          });
          return;
        }

        // Broadcast room:closed to all room members
        this.broadcastToRoom(targetRoomId, {
          type: 'room:closed',
          roomId: targetRoomId,
          closedBy: conn.userId,
          reason: 'Комната была закрыта создателем.',
        });

        // Disconnect all clients in the room
        this.connections.forEach((c, socket) => {
          if (c.roomId === targetRoomId) {
            try {
              socket.close(4000, 'Room Closed');
            } catch {}
          }
        });
        break;
      }

      case 'room:hostAction': {
        const action = msg.action;
        const room = await getRoom(targetRoomId);
        if (!room) return;

        if (room.hostId !== conn.userId) {
          this.send(conn.ws, { type: 'error', message: 'Только хост может выполнять действия управления' });
          return;
        }

        if (action === 'startBroadcast') {
          await startBroadcast(targetRoomId, {
            mic: msg.mic !== false,
            videoUrl: msg.videoUrl,
            playing: msg.playing,
          }, conn.userId);

          this.broadcastToRoom(targetRoomId, {
            type: 'room_state',
            state: rooms[targetRoomId],
          });
        } else if (action === 'transferHost' && msg.newHostId) {
          const res = await transferHost(targetRoomId, msg.newHostId, conn.userId);
          if (res.success && res.targetMember) {
            this.broadcastToRoom(targetRoomId, {
              type: 'room:newHost',
              roomId: targetRoomId,
              newHostId: res.targetMember.userId,
              newHostName: res.targetMember.name,
              newHostAvatar: res.targetMember.avatar,
            });
            this.broadcastParticipantsUpdate(targetRoomId);
          }
        } else if (action === 'toggleControl') {
          room.anyoneCanControl = !room.anyoneCanControl;
          this.broadcastToRoom(targetRoomId, {
            type: 'room_state',
            state: room,
          });
        }
        break;
      }

      // =====================================
      // 2. VIDEO PLAYER SYNCHRONIZATION
      // =====================================

      case 'player:state':
      case 'sync:play':
      case 'sync:pause':
      case 'play_video':
      case 'pause_video': {
        const room = await getRoom(targetRoomId);
        if (!room) return;
        const isHost = room.hostId === conn.userId;
        if (!room.anyoneCanControl && !isHost) {
          this.send(conn.ws, { type: 'error', message: 'Управление заблокировано создателем' });
          return;
        }

        const isPlaying = msg.type === 'player:state'
          ? Boolean(msg.playing ?? (msg.state === 'playing'))
          : (msg.type === 'sync:play' || msg.type === 'play_video');

        const newTime = msg.currentTime !== undefined ? Number(msg.currentTime) : Number(msg.time ?? room.currentTime);
        room.playing = isPlaying;
        room.isPlaying = isPlaying;
        room.currentTime = newTime;
        room.lastUpdated = Date.now();

        this.broadcastToRoom(targetRoomId, {
          type: 'player:state',
          playing: isPlaying,
          isPlaying,
          state: isPlaying ? 'playing' : 'paused',
          currentTime: newTime,
          time: newTime,
          senderId: conn.userId,
        });

        this.broadcastToRoom(targetRoomId, {
          type: 'playback_change',
          playing: isPlaying,
          currentTime: newTime,
          senderId: conn.userId,
        });
        break;
      }

      case 'player:seek':
      case 'sync:seek':
      case 'seek_video': {
        const room = await getRoom(targetRoomId);
        if (!room) return;
        const isHost = room.hostId === conn.userId;
        if (!room.anyoneCanControl && !isHost) return;

        const targetTime = Number(msg.currentTime !== undefined ? msg.currentTime : msg.time ?? 0);
        room.currentTime = targetTime;
        room.lastUpdated = Date.now();

        this.broadcastToRoom(targetRoomId, {
          type: 'player:seek',
          currentTime: targetTime,
          time: targetTime,
          playing: room.playing,
          senderId: conn.userId,
        });

        this.broadcastToRoom(targetRoomId, {
          type: 'sync_seek',
          currentTime: targetTime,
          senderId: conn.userId,
        });
        break;
      }

      case 'player:heartbeat':
      case 'heartbeat_update': {
        const room = await getRoom(targetRoomId);
        if (!room) return;
        const isHost = room.hostId === conn.userId;
        if (!isHost && !room.anyoneCanControl) return;

        const time = Number(msg.currentTime !== undefined ? msg.currentTime : msg.time ?? room.currentTime);
        room.currentTime = time;
        if (msg.playing !== undefined) {
          room.playing = Boolean(msg.playing);
          room.isPlaying = Boolean(msg.playing);
        }
        room.lastUpdated = Date.now();

        this.broadcastToRoom(targetRoomId, {
          type: 'player:heartbeat',
          currentTime: time,
          time,
          playing: room.playing,
          isPlaying: room.isPlaying,
          state: room.playing ? 'playing' : 'paused',
          playbackRate: msg.playbackRate || 1,
          senderId: conn.userId,
        }, conn.userId);
        break;
      }

      case 'sync:video_url':
      case 'change_video': {
        const room = await getRoom(targetRoomId);
        if (!room) return;
        const isHost = room.hostId === conn.userId;
        if (!room.anyoneCanControl && !isHost) return;

        room.videoUrl = msg.videoUrl;
        room.provider = msg.provider || 'unknown';
        room.videoId = msg.videoId || '';
        room.currentTime = 0;
        room.playing = true;
        room.isPlaying = true;
        room.lastUpdated = Date.now();

        this.broadcastToRoom(targetRoomId, {
          type: 'room_state',
          state: room,
        });
        break;
      }

      // =====================================
      // 3. CHAT MESSAGING
      // =====================================

      case 'chat_message': {
        const room = await getRoom(targetRoomId);
        if (!room) return;

        const chatMsg: any = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: 'user',
          userId: conn.userId,
          name: conn.name,
          avatar: conn.avatar,
          color: conn.color,
          text: msg.text,
          timestamp: Date.now(),
          reactions: {},
        };

        room.chatHistory.push(chatMsg);

        this.broadcastToRoom(targetRoomId, {
          type: 'chat_broadcast',
          message: chatMsg,
        });

        // Also broadcast chat:newMessage for explicit notification listeners
        this.broadcastToRoom(targetRoomId, {
          type: 'chat:newMessage',
          roomId: targetRoomId,
          message: chatMsg,
        });
        break;
      }

      case 'chat:typing':
      case 'typing': {
        this.broadcastToRoom(
          targetRoomId,
          {
            type: 'chat:typing',
            roomId: targetRoomId,
            userId: conn.userId,
            name: msg.name || conn.name,
            avatar: msg.avatar || conn.avatar,
            isTyping: msg.isTyping !== false,
          },
          conn.userId // exclude sender
        );
        break;
      }

      case 'react_message': {
        const room = await getRoom(targetRoomId);
        if (!room) return;
        const targetMsg = room.chatHistory.find((m) => m.id === msg.messageId);
        if (targetMsg) {
          targetMsg.reactions = targetMsg.reactions || {};
          const userList = targetMsg.reactions[msg.emoji] || [];
          if (userList.includes(conn.userId)) {
            targetMsg.reactions[msg.emoji] = userList.filter((id) => id !== conn.userId);
          } else {
            targetMsg.reactions[msg.emoji] = [...userList, conn.userId];
          }
          if (targetMsg.reactions[msg.emoji].length === 0) {
            delete targetMsg.reactions[msg.emoji];
          }
          this.broadcastToRoom(targetRoomId, {
            type: 'room_state',
            state: room,
          });
        }
        break;
      }

      // =====================================
      // 4. WEBRTC MESH VOICE SIGNALING
      // =====================================

      case 'voice:join': {
        const vRoom = this.getVoiceRoom(targetRoomId);
        const peerInfo: VoicePeer = {
          userId: conn.userId,
          name: msg.name || conn.name,
          avatar: msg.avatar || conn.avatar,
          color: msg.color || conn.color,
          isMuted: Boolean(msg.isMuted),
          isDeafened: Boolean(msg.isDeafened),
          isSpeaking: false,
          audioLevel: 0,
        };

        vRoom.set(conn.userId, peerInfo);

        this.send(conn.ws, {
          type: 'voice:peers_list',
          peers: Array.from(vRoom.values()).filter((p) => p.userId !== conn.userId),
        });

        this.broadcastToRoom(targetRoomId, {
          type: 'voice:user_joined',
          peer: peerInfo,
          userId: conn.userId,
        }, conn.userId);
        break;
      }

      case 'voice:leave': {
        const vRoom = this.getVoiceRoom(targetRoomId);
        if (vRoom.has(conn.userId)) {
          vRoom.delete(conn.userId);
          this.broadcastToRoom(targetRoomId, {
            type: 'voice:user_left',
            userId: conn.userId,
          });
        }
        break;
      }

      case 'voice:offer': {
        if (msg.toUserId && msg.offer) {
          this.sendToUserInRoom(targetRoomId, msg.toUserId, {
            type: 'voice:offer',
            fromUserId: conn.userId,
            offer: msg.offer,
            name: conn.name,
            avatar: conn.avatar,
            color: conn.color,
          });
        }
        break;
      }

      case 'voice:answer': {
        if (msg.toUserId && msg.answer) {
          this.sendToUserInRoom(targetRoomId, msg.toUserId, {
            type: 'voice:answer',
            fromUserId: conn.userId,
            answer: msg.answer,
          });
        }
        break;
      }

      case 'voice:ice_candidate':
      case 'voice:ice': {
        if (msg.toUserId && (msg.candidate || msg.ice)) {
          this.sendToUserInRoom(targetRoomId, msg.toUserId, {
            type: 'voice:ice_candidate',
            fromUserId: conn.userId,
            candidate: msg.candidate || msg.ice,
          });
        }
        break;
      }

      case 'voice:state': {
        const vRoom = this.getVoiceRoom(targetRoomId);
        const currentVoice = vRoom.get(conn.userId);
        if (currentVoice) {
          if (typeof msg.isMuted === 'boolean') currentVoice.isMuted = msg.isMuted;
          if (typeof msg.isDeafened === 'boolean') currentVoice.isDeafened = msg.isDeafened;
        }
        this.broadcastToRoom(targetRoomId, {
          type: 'voice:state',
          userId: conn.userId,
          isMuted: msg.isMuted,
          isDeafened: msg.isDeafened,
        });
        break;
      }

      case 'voice:active':
      case 'voice:speaking': {
        const vRoom = this.getVoiceRoom(targetRoomId);
        const currentVoice = vRoom.get(conn.userId);
        const isSpeaking = typeof msg.isSpeaking === 'boolean' ? msg.isSpeaking : Boolean(msg.active);
        const volume = typeof msg.volume === 'number' ? msg.volume : (msg.audioLevel ?? 0);

        if (currentVoice) {
          currentVoice.isSpeaking = isSpeaking;
          currentVoice.audioLevel = volume;
        }

        this.broadcastToRoom(targetRoomId, {
          type: 'voice:active',
          userId: conn.userId,
          isSpeaking,
          volume,
          audioLevel: volume,
        });
        break;
      }

      default:
        break;
    }
  }

  /**
   * Helper: Handle room join
   */
  private async handleRoomJoin(conn: ClientConnection, msg: any) {
    const roomId = parseRoomId(msg.roomId || conn.roomId);
    conn.roomId = roomId;
    conn.userId = msg.userId || conn.userId;
    conn.name = msg.name || conn.name;
    conn.avatar = msg.avatar || conn.avatar;
    conn.color = msg.color || conn.color;

    const { room, member, isNewHost } = await joinRoom(roomId, {
      userId: conn.userId,
      name: conn.name,
      avatar: conn.avatar,
      color: conn.color,
    });

    // Send complete room state to joining client
    this.send(conn.ws, {
      type: 'room_state',
      state: room,
      isHost: isNewHost || room.hostId === conn.userId,
    });

    // Broadcast participants and updated room state
    this.broadcastToRoom(roomId, {
      type: 'room_state',
      state: room,
    });

    this.broadcastToRoom(roomId, {
      type: 'room:userJoined',
      roomId,
      user: member,
      userId: conn.userId,
      name: conn.name,
      avatar: conn.avatar,
    }, conn.userId);

    this.broadcastParticipantsUpdate(roomId);
  }

  /**
   * Helper: Handle clean leave / disconnect
   */
  private async handleRoomLeave(conn: ClientConnection) {
    if (!conn.roomId || !conn.userId) return;

    this.broadcastToRoom(conn.roomId, {
      type: 'room:userLeft',
      roomId: conn.roomId,
      userId: conn.userId,
      name: conn.name,
    }, conn.userId);

    const vRoom = this.voiceRooms.get(conn.roomId);
    if (vRoom && vRoom.has(conn.userId)) {
      vRoom.delete(conn.userId);
      this.broadcastToRoom(conn.roomId, {
        type: 'voice:user_left',
        userId: conn.userId,
      });
    }

    const { room, deleted, newHostId, newHostMember } = await leaveRoom(conn.roomId, conn.userId);

    if (deleted) {
      this.broadcastToRoom(conn.roomId, {
        type: 'room:closed',
        roomId: conn.roomId,
        reason: 'Все участники покинули комнату. Комната закрыта.',
      });
    } else if (room) {
      if (newHostId && newHostMember) {
        this.broadcastToRoom(conn.roomId, {
          type: 'room:newHost',
          roomId: conn.roomId,
          newHostId,
          newHostName: newHostMember.name,
          newHostAvatar: newHostMember.avatar,
        });
      }

      this.broadcastToRoom(conn.roomId, {
        type: 'room_state',
        state: room,
      });

      this.broadcastParticipantsUpdate(conn.roomId);
    }
  }

  /**
   * Handle socket disconnect
   */
  private async handleDisconnect(conn: ClientConnection) {
    this.connections.delete(conn.ws);
    await this.handleRoomLeave(conn);
  }

  /**
   * Broadcast participant list update to room
   */
  public broadcastParticipantsUpdate(roomId: string) {
    const participants = getParticipants(roomId);
    const room = rooms[roomId];
    this.broadcastToRoom(roomId, {
      type: 'room:updateParticipants',
      roomId,
      members: participants,
      hostId: room?.hostId,
      count: participants.length,
    });
  }

  public getVoiceRoom(roomId: string): Map<string, VoicePeer> {
    if (!this.voiceRooms.has(roomId)) {
      this.voiceRooms.set(roomId, new Map());
    }
    return this.voiceRooms.get(roomId)!;
  }

  public send(ws: WebSocket, payload: any) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  public sendToUserInRoom(roomId: string, targetUserId: string, payload: any) {
    const json = JSON.stringify(payload);
    this.connections.forEach((conn, socket) => {
      if (conn.roomId === roomId && conn.userId === targetUserId && socket.readyState === WebSocket.OPEN) {
        socket.send(json);
      }
    });
  }

  public broadcastToRoom(roomId: string, payload: any, excludeUserId?: string) {
    const json = JSON.stringify(payload);
    this.connections.forEach((conn, socket) => {
      if (conn.roomId === roomId && conn.userId !== excludeUserId && socket.readyState === WebSocket.OPEN) {
        socket.send(json);
      }
    });
  }
}

export const signalingServer = new SignalingServer();
