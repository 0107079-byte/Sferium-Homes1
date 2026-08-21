/**
 * Backend Rooms Management Module (backend/rooms.ts)
 * 
 * Implements:
 * 1. Role System: Creator gets role 'host', all other participants get role 'guest'.
 * 2. Host Capabilities: kickUser, muteUser, startBroadcast({ mic: false }), closeRoom, transferHost.
 * 3. Host Migration: pickRandomGuest, assignHost, broadcasting room:newHost.
 * 4. Automatic Room Deletion: deleteRoom when 0 participants left, clears chat, history, player state.
 * 5. Persistent & Memory sync with Sferium DB.
 */

import { RoomState, Member, UserRole, VideoProvider, ChatMessage, RoomSummary, CreateRoomPayload } from '../src/types';
import { loadRoomFromDb, saveRoomToDb, deleteRoomFromDb, getAllRoomsFromDb } from '../src/db';

// Global In-Memory active rooms state
export const rooms: Record<string, RoomState> = {};

/**
 * Generate human-readable secure room code
 */
export function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Parse & sanitize Room ID
 */
export function parseRoomId(input: string): string {
  if (!input) return '';
  let str = input.trim().replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '');
  if (str.includes('/room/')) str = str.split('/room/').pop() || '';
  else if (str.includes('/invite/')) str = str.split('/invite/').pop() || '';
  else if (str.includes('room=')) {
    const m = str.match(/room=([^&]+)/);
    if (m) str = m[1] || '';
  }
  if (str.includes('/')) str = str.split('/').pop() || '';
  return str.replace(/[^A-Z0-9_-]/gi, '').toUpperCase() || 'CINEMA';
}

/**
 * Detect provider from video URL
 */
export function detectProvider(url: string): VideoProvider {
  if (!url) return 'unknown';
  const cleanUrl = url.trim();
  if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) return 'youtube';
  if (cleanUrl.includes('vk.com') || cleanUrl.includes('vkvideo.ru')) return 'vk';
  if (cleanUrl.includes('rutube.ru')) return 'rutube';
  if (cleanUrl.includes('yandex.ru') || cleanUrl.includes('dzen.ru')) return 'yandex';
  if (cleanUrl.match(/\.(mp4|webm|mov|m3u8|mpd)(\?.*)?$/i) || cleanUrl.startsWith('http')) return 'direct';
  return 'unknown';
}

/**
 * Get or load room from memory/database
 */
export async function getRoom(roomId: string): Promise<RoomState | null> {
  const cleanId = parseRoomId(roomId);
  if (rooms[cleanId]) {
    return rooms[cleanId];
  }
  try {
    const dbRoom = await loadRoomFromDb(cleanId);
    if (dbRoom) {
      rooms[cleanId] = dbRoom;
      rooms[cleanId].members = rooms[cleanId].members || {};
      return rooms[cleanId];
    }
  } catch (err) {
    console.warn(`[ROOMS] Error loading room #${cleanId} from db:`, err);
  }
  return null;
}

/**
 * Create a new Room. Creator receives role 'host'.
 */
export async function createRoom(payload: CreateRoomPayload): Promise<RoomState> {
  const cleanId = parseRoomId(payload.roomId || generateRoomCode());
  const initialVideo = (payload.initialVideoUrl || 'https://www.youtube.com/watch?v=jfKfPfyJRdk').trim();
  const provider = detectProvider(initialVideo);

  const hostMember: Member = {
    userId: payload.hostId,
    name: payload.hostName || 'Создатель',
    avatar: payload.hostAvatar || '👑',
    color: payload.hostColor || '#6366f1',
    isHost: true,
    role: 'host',
    isSpeaking: false,
    audioLevel: 0,
  };

  const newRoom: RoomState = {
    roomId: cleanId,
    name: payload.name?.trim() || `Кинозал #${cleanId}`,
    description: payload.description?.trim() || '',
    isPrivate: Boolean(payload.isPrivate),
    password: payload.password?.trim() || undefined,
    tags: payload.tags && payload.tags.length > 0 ? payload.tags : ['Кино & Видео'],
    maxMembers: payload.maxMembers || 50,
    createdAt: Date.now(),
    hostId: payload.hostId,
    hostName: payload.hostName || 'Создатель',
    hostAvatar: payload.hostAvatar || '👑',
    videoUrl: initialVideo,
    provider,
    currentTime: 0,
    playing: false,
    isPlaying: false,
    lastUpdated: Date.now(),
    anyoneCanControl: payload.anyoneCanControl !== undefined ? payload.anyoneCanControl : false,
    defaultRole: 'member',
    bannedUserIds: [],
    members: {
      [payload.hostId]: hostMember,
    },
    chatHistory: [
      {
        id: `sys_init_${Date.now()}`,
        type: 'system',
        text: `🍿 Зал Sferium Homes #${cleanId} открыт! Создатель: ${hostMember.name}.`,
        timestamp: Date.now(),
      },
    ],
  };

  rooms[cleanId] = newRoom;
  await saveRoomToDb(newRoom);
  return newRoom;
}

/**
 * Add / join participant to room.
 * If user is creator/hostId, gets role 'host'; otherwise role 'guest'.
 */
export async function joinRoom(
  roomId: string,
  user: { userId: string; name: string; avatar?: string; color?: string }
): Promise<{ room: RoomState; member: Member; isNewHost: boolean }> {
  const cleanId = parseRoomId(roomId);
  let room = await getRoom(cleanId);

  if (!room) {
    // Automatically create room with this user as host
    room = await createRoom({
      roomId: cleanId,
      name: `Кинозал #${cleanId}`,
      hostId: user.userId,
      hostName: user.name,
      hostAvatar: user.avatar || '🍿',
      hostColor: user.color || '#6366f1',
    });
    return { room, member: room.members[user.userId], isNewHost: true };
  }

  const isExisting = Boolean(room.members[user.userId]);
  const isFirstMember = Object.keys(room.members).length === 0;
  const isHost = room.hostId === user.userId || isFirstMember;

  if (isHost) {
    room.hostId = user.userId;
    room.hostName = user.name;
    room.hostAvatar = user.avatar || '👑';
  }

  const role: UserRole = isHost ? 'host' : 'member';

  const member: Member = {
    userId: user.userId,
    name: user.name,
    avatar: user.avatar || (isHost ? '👑' : '🍿'),
    color: user.color || (isHost ? '#6366f1' : '#a855f7'),
    isHost,
    role,
    isSpeaking: false,
    audioLevel: 0,
  };

  room.members[user.userId] = member;

  // Add system message if newly joined
  if (!isExisting) {
    room.chatHistory.push({
      id: `sys_join_${user.userId}_${Date.now()}`,
      type: 'system',
      text: `👋 ${member.avatar} ${member.name} (${isHost ? '👑 Хост' : '👤 Гость'}) присоединился к залу.`,
      timestamp: Date.now(),
    });
  }

  await saveRoomToDb(room);
  return { room, member, isNewHost: isHost };
}

/**
 * Handle user leaving room.
 * If the host leaves, automatically migrates host role to a random guest.
 * If 0 members remaining, calls deleteRoom(roomId).
 */
export async function leaveRoom(
  roomId: string,
  userId: string
): Promise<{
  room: RoomState | null;
  deleted: boolean;
  newHostId: string | null;
  newHostMember: Member | null;
}> {
  const cleanId = parseRoomId(roomId);
  const room = await getRoom(cleanId);
  if (!room) {
    return { room: null, deleted: false, newHostId: null, newHostMember: null };
  }

  const leavingMember = room.members[userId];
  if (leavingMember) {
    room.chatHistory.push({
      id: `sys_leave_${userId}_${Date.now()}`,
      type: 'system',
      text: `🚪 ${leavingMember.avatar} ${leavingMember.name} покинул кинозал.`,
      timestamp: Date.now(),
    });
    delete room.members[userId];
  }

  const activeMembers = Object.values(room.members);

  // If 0 participants, delete room completely
  if (activeMembers.length === 0) {
    await deleteRoom(cleanId);
    return { room: null, deleted: true, newHostId: null, newHostMember: null };
  }

  let newHostId: string | null = null;
  let newHostMember: Member | null = null;

  // If leaving member was the host, pick random guest and assign as new host
  if (room.hostId === userId || leavingMember?.isHost) {
    const chosenGuestId = pickRandomGuest(cleanId);
    if (chosenGuestId) {
      const assigned = assignHost(cleanId, chosenGuestId);
      if (assigned) {
        newHostId = chosenGuestId;
        newHostMember = assigned;
        room.chatHistory.push({
          id: `sys_host_${newHostId}_${Date.now()}`,
          type: 'system',
          text: `👑 Создатель покинул кинозал. Новым хостом назначен ${assigned.avatar} ${assigned.name}!`,
          timestamp: Date.now(),
        });
      }
    }
  }

  await saveRoomToDb(room);
  return { room, deleted: false, newHostId, newHostMember };
}

/**
 * Pick a random guest/participant from room
 */
export function pickRandomGuest(roomId: string): string | null {
  const cleanId = parseRoomId(roomId);
  const room = rooms[cleanId];
  if (!room) return null;

  const memberKeys = Object.keys(room.members);
  if (memberKeys.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * memberKeys.length);
  return memberKeys[randomIndex];
}

/**
 * Assign new host for a room
 */
export function assignHost(roomId: string, newHostId: string): Member | null {
  const cleanId = parseRoomId(roomId);
  const room = rooms[cleanId];
  if (!room || !room.members[newHostId]) return null;

  // Demote previous hosts
  Object.values(room.members).forEach((m) => {
    if (m.userId !== newHostId && m.isHost) {
      m.isHost = false;
      m.role = 'member';
    }
  });

  const target = room.members[newHostId];
  target.isHost = true;
  target.role = 'host';
  room.hostId = newHostId;
  room.hostName = target.name;
  room.hostAvatar = target.avatar;

  return target;
}

/**
 * Transfer Host authority explicitly
 */
export async function transferHost(
  roomId: string,
  newHostId: string,
  actorUserId?: string
): Promise<{ success: boolean; error?: string; targetMember?: Member }> {
  const cleanId = parseRoomId(roomId);
  const room = await getRoom(cleanId);
  if (!room) return { success: false, error: 'Комната не найдена' };

  if (actorUserId && room.hostId !== actorUserId) {
    return { success: false, error: 'Только действующий хост может передать управление' };
  }

  const target = room.members[newHostId];
  if (!target) return { success: false, error: 'Выбранный участник не найден' };

  assignHost(cleanId, newHostId);

  room.chatHistory.push({
    id: `sys_transfer_${newHostId}_${Date.now()}`,
    type: 'system',
    text: `👑 Роль Создателя зала была передана участнику ${target.avatar} ${target.name}!`,
    timestamp: Date.now(),
  });

  await saveRoomToDb(room);
  return { success: true, targetMember: target };
}

/**
 * Kick a guest user (Host permission required)
 */
export async function kickUser(
  roomId: string,
  targetUserId: string,
  actorUserId: string,
  reason = 'Исключен создателем комнаты'
): Promise<{ success: boolean; error?: string; kickedMember?: Member }> {
  const cleanId = parseRoomId(roomId);
  const room = await getRoom(cleanId);
  if (!room) return { success: false, error: 'Комната не найдена' };

  if (room.hostId !== actorUserId) {
    return { success: false, error: 'У вас нет прав на исключение участников' };
  }

  if (targetUserId === actorUserId) {
    return { success: false, error: 'Хост не может кикнуть самого себя' };
  }

  const targetMember = room.members[targetUserId];
  if (!targetMember) return { success: false, error: 'Участник не найден' };

  delete room.members[targetUserId];

  room.chatHistory.push({
    id: `sys_kick_${targetUserId}_${Date.now()}`,
    type: 'system',
    text: `👢 ${targetMember.avatar} ${targetMember.name} был исключен создателем (${reason}).`,
    timestamp: Date.now(),
  });

  await saveRoomToDb(room);
  return { success: true, kickedMember: targetMember };
}

/**
 * Mute a guest user (Host permission required)
 */
export async function muteUser(
  roomId: string,
  targetUserId: string,
  actorUserId: string,
  isMuted = true
): Promise<{ success: boolean; error?: string; targetMember?: Member }> {
  const cleanId = parseRoomId(roomId);
  const room = await getRoom(cleanId);
  if (!room) return { success: false, error: 'Комната не найдена' };

  if (room.hostId !== actorUserId) {
    return { success: false, error: 'У вас нет прав на выключение микрофона' };
  }

  const targetMember = room.members[targetUserId];
  if (!targetMember) return { success: false, error: 'Участник не найден' };

  targetMember.isMutedByMod = isMuted;

  room.chatHistory.push({
    id: `sys_mute_${targetUserId}_${Date.now()}`,
    type: 'system',
    text: isMuted
      ? `🔇 Микрофон ${targetMember.avatar} ${targetMember.name} выключен создателем комнаты.`
      : `🔊 Создатель разрешил микрофон для ${targetMember.avatar} ${targetMember.name}.`,
    timestamp: Date.now(),
  });

  await saveRoomToDb(room);
  return { success: true, targetMember };
}

/**
 * Start broadcast with options (e.g. mic: false)
 */
export async function startBroadcast(
  roomId: string,
  options: { mic?: boolean; videoUrl?: string; playing?: boolean },
  actorUserId: string
): Promise<{ success: boolean; error?: string }> {
  const cleanId = parseRoomId(roomId);
  const room = await getRoom(cleanId);
  if (!room) return { success: false, error: 'Комната не найдена' };

  if (room.hostId !== actorUserId) {
    return { success: false, error: 'Только хост может управлять эфиром' };
  }

  if (options.videoUrl) {
    room.videoUrl = options.videoUrl;
    room.provider = detectProvider(options.videoUrl);
  }

  if (options.playing !== undefined) {
    room.playing = options.playing;
    room.isPlaying = options.playing;
  }

  room.lastUpdated = Date.now();

  room.chatHistory.push({
    id: `sys_broadcast_${Date.now()}`,
    type: 'system',
    text: `📡 Создатель запустил эфир ${options.mic === false ? '(без микрофона)' : '(с голосовым чатом)'}.`,
    timestamp: Date.now(),
  });

  await saveRoomToDb(room);
  return { success: true };
}

/**
 * Manually close room (Host only)
 * Completely deletes all chat history, player state, participant lists.
 */
export async function closeRoom(
  roomId: string,
  actorUserId?: string
): Promise<{ success: boolean; error?: string }> {
  const cleanId = parseRoomId(roomId);
  const room = await getRoom(cleanId);
  if (!room) return { success: false, error: 'Комната не найдена' };

  if (actorUserId && room.hostId !== actorUserId) {
    return { success: false, error: 'Только создатель комнаты может закрыть её' };
  }

  await deleteRoom(cleanId);
  return { success: true };
}

/**
 * Completely delete room, chat, player state, participant list, temp data
 */
export async function deleteRoom(roomId: string): Promise<void> {
  const cleanId = parseRoomId(roomId);
  console.log(`[ROOM DELETION] Purging room #${cleanId}: chat, player state, and participant lists deleted.`);
  
  if (rooms[cleanId]) {
    rooms[cleanId].members = {};
    rooms[cleanId].chatHistory = [];
    delete rooms[cleanId];
  }

  try {
    await deleteRoomFromDb(cleanId);
  } catch (err) {
    console.warn(`[ROOM DELETION] Error purging room #${cleanId} from db:`, err);
  }
}

/**
 * Get active participants list
 */
export function getParticipants(roomId: string): Member[] {
  const cleanId = parseRoomId(roomId);
  const room = rooms[cleanId];
  if (!room || !room.members) return [];
  return Object.values(room.members);
}
