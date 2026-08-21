/**
 * Server-side synchronization module for Sferium Homes Sync
 * Discord-like Roles & Permissions Architecture
 */

import { WebSocket } from 'ws';
import {
  RoomState,
  ChatMessage,
  Member,
  VideoProvider,
  UserRole,
  RolePermissions,
  DEFAULT_ROLE_PERMISSIONS,
} from '../../src/types';
import { loadRoomFromDb, saveRoomToDb, deleteRoomFromDb } from '../../src/db';

export interface ClientConnection {
  ws: WebSocket;
  roomId: string;
  userId: string;
  name?: string;
  avatar?: string;
  color?: string;
}

// In-memory active room storage
export const rooms: { [roomId: string]: RoomState } = {};

// Active client WebSocket connection registry
export const clientConnections = new Map<WebSocket, ClientConnection>();

// Throttling map to avoid seek/event spamming
export const lastActionTimes = new Map<string, number>();

/**
 * Calculates current playback time for room
 */
export function getEstimatedRoomTime(room: RoomState): number {
  if (!room) return 0;
  const isPlaying = room.playing || room.isPlaying;
  if (!isPlaying) return room.currentTime || 0;

  const lastUpdated = room.lastUpdated || Date.now();
  const elapsedSeconds = (Date.now() - lastUpdated) / 1000;
  const rate = room.playbackRate || 1;
  return (room.currentTime || 0) + elapsedSeconds * rate;
}

/**
 * Updates room current time based on elapsed clock
 */
export function updateRoomCurrentTime(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;
  if (room.playing || room.isPlaying) {
    room.currentTime = getEstimatedRoomTime(room);
    room.lastUpdated = Date.now();
  }
}

/**
 * Returns effective permissions for a user in a room
 */
export function getUserEffectivePermissions(room: RoomState, userId: string): RolePermissions {
  if (!room) return DEFAULT_ROLE_PERMISSIONS.viewer;

  const isHost = room.hostId === userId;
  if (isHost) {
    return { ...DEFAULT_ROLE_PERMISSIONS.host };
  }

  const member = room.members[userId];
  const role: UserRole = member?.role || room.defaultRole || 'member';

  const basePermissions = {
    ...DEFAULT_ROLE_PERMISSIONS[role],
    ...(room.rolePermissionsOverride?.[role] || {}),
    ...(member?.customPermissions || {}),
  };

  // If anyoneCanControl is turned on and user is not a restricted viewer, grant manageVideo
  if (room.anyoneCanControl && role !== 'viewer') {
    basePermissions.manageVideo = true;
  }

  return basePermissions;
}

/**
 * Checks if user is allowed to control playback in room
 */
export function canUserControl(room: RoomState, userId: string): boolean {
  if (!room) return false;
  const permissions = getUserEffectivePermissions(room, userId);
  return permissions.manageVideo;
}

/**
 * Role hierarchy checker (Host > Moderator > Member > Viewer)
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  host: 4,
  moderator: 3,
  member: 2,
  viewer: 1,
};

/**
 * Checks if actor can modify target user's role or status
 */
export function canActorManageTarget(room: RoomState, actorId: string, targetId: string): boolean {
  if (actorId === targetId) return false;
  if (room.hostId === actorId) return true; // Host can manage everyone
  if (room.hostId === targetId) return false; // Nobody can manage Host

  const actorMember = room.members[actorId];
  const targetMember = room.members[targetId];
  if (!actorMember || !targetMember) return false;

  const actorRole: UserRole = actorMember.role || 'member';
  const targetRole: UserRole = targetMember.role || 'member';

  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
}

/**
 * Broadcasts message and synchronized state to all clients in a room
 */
export function broadcastToRoom(roomId: string, message: any) {
  if (rooms[roomId]) {
    updateRoomCurrentTime(roomId);
    message.state = rooms[roomId];
  }

  const payload = JSON.stringify(message);

  clientConnections.forEach((conn, ws) => {
    if (conn.roomId === roomId && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
      } catch (err) {
        console.error(`[WS Broadcast Error] Client ${conn.userId} in room ${roomId}:`, err);
      }
    }
  });
}

/**
 * Sends a message directly to a target user in a room
 */
export function sendToUserInRoom(roomId: string, targetUserId: string, message: any) {
  const payload = JSON.stringify(message);
  clientConnections.forEach((conn, ws) => {
    if (conn.roomId === roomId && conn.userId === targetUserId && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
      } catch (err) {
        console.error(`[WS Direct Send Error] Target ${targetUserId} in room ${roomId}:`, err);
      }
    }
  });
}

/**
 * Initializes or loads room from database
 */
export async function getOrCreateRoom(
  roomId: string,
  hostUserId: string,
  hostName = 'Киноман',
  hostAvatar = '🍿',
  hostColor = '#a855f7'
): Promise<RoomState> {
  const cleanId = roomId.toUpperCase();

  if (rooms[cleanId]) {
    return rooms[cleanId];
  }

  // Try to load from persistent DB
  try {
    const dbRoom = await loadRoomFromDb(cleanId);
    if (dbRoom) {
      rooms[cleanId] = dbRoom;
      rooms[cleanId].members = rooms[cleanId].members || {};
      rooms[cleanId].bannedUserIds = rooms[cleanId].bannedUserIds || [];
      rooms[cleanId].defaultRole = rooms[cleanId].defaultRole || 'member';
      return rooms[cleanId];
    }
  } catch (e) {
    console.warn(`[DB Load Error] Room #${cleanId}:`, e);
  }

  // Create new room
  const newRoom: RoomState = {
    roomId: cleanId,
    hostId: hostUserId,
    videoUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    provider: 'youtube',
    videoId: 'jfKfPfyJRdk',
    currentTime: 0,
    playing: false,
    isPlaying: false,
    lastUpdated: Date.now(),
    anyoneCanControl: true,
    bannedUserIds: [],
    defaultRole: 'member',
    members: {
      [hostUserId]: {
        userId: hostUserId,
        name: hostName,
        avatar: hostAvatar,
        color: hostColor,
        isHost: true,
        role: 'host',
      },
    },
    chatHistory: [
      {
        id: `sys-${Date.now()}`,
        type: 'system',
        text: `🍿 Зал Sferium Homes #${cleanId} готов к совместному просмотру!`,
        timestamp: Date.now(),
      },
    ],
  };

  rooms[cleanId] = newRoom;
  saveRoomToDb(newRoom);
  return newRoom;
}
