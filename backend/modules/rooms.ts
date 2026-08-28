/**
 * Rooms Management Module for Sferium Homes Sync (AI Studio / Express)
 * Provides comprehensive Room lifecycle management:
 * - List active public/private rooms
 * - Create new room with custom metadata (name, tags, privacy, password, video)
 * - Explicit Join room with PostgreSQL validation and Source of Truth
 * - Delete room with host authority
 * - Verify private room passcodes
 * - Broadcast updates to lobby subscribers
 */

import { WebSocket } from 'ws';
import { RoomState, RoomSummary, CreateRoomPayload, VideoProvider, Member } from '../../src/types';
import { loadRoomFromDb, saveRoomToDb, deleteRoomFromDb, getAllRoomsFromDb, addMemberToDb, normalizeRoomCode } from '../../src/db';
import { rooms, clientConnections } from './sync';
export { rooms };

// Global subscribers for lobby room updates (WebSocket clients on the lobby page)
export const lobbySubscribers = new Set<WebSocket>();

export function registerLobbySubscriber(ws: WebSocket) {
  lobbySubscribers.add(ws);
}

export function unregisterLobbySubscriber(ws: WebSocket) {
  lobbySubscribers.delete(ws);
}

/**
 * Generate human-readable random secure room code (e.g. "CINEMA", "NEO7X", "RAVE42")
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
 * Helper to extract video thumbnail and title if available
 */
export function getVideoMetadata(url: string, provider?: VideoProvider): { title?: string; thumbnail?: string } {
  if (!url) return {};
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const match = url.match(/(?:v=|\/embed\/|\/shorts\/|\/v\/|youtu\.be\/|\/watch\?.*v=)([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) {
      return {
        title: 'YouTube Видео',
        thumbnail: `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`,
      };
    }
  }
  if (url.includes('vk.com') || url.includes('vkvideo.ru')) {
    return {
      title: 'VK Видео Трансляция',
      thumbnail: 'https://vk.com/images/svg_icons/ic_video.svg',
    };
  }
  if (url.includes('rutube.ru')) {
    return {
      title: 'Rutube Видео Эфир',
      thumbnail: 'https://pic.rutubelist.ru/static/favicon/favicon-192x192.png',
    };
  }
  return { title: 'Прямой видеопоток' };
}

/**
 * Transform full RoomState into lightweight RoomSummary for lobby display
 */
export function toRoomSummary(room: RoomState): RoomSummary {
  const members = Object.values(room.members || {});
  const meta = getVideoMetadata(room.videoUrl, room.provider);

  return {
    roomId: room.roomId,
    name: room.name || `Кинозал #${room.roomId}`,
    description: room.description || '',
    isPrivate: Boolean(room.isPrivate),
    hasPassword: Boolean(room.password && room.password.length > 0),
    tags: room.tags && room.tags.length > 0 ? room.tags : ['Кино & Видео', 'Sync'],
    createdAt: room.createdAt || Date.now(),
    hostId: room.hostId,
    hostName: room.hostName || members.find((m) => m.userId === room.hostId)?.name || 'Создатель',
    hostAvatar: room.hostAvatar || members.find((m) => m.userId === room.hostId)?.avatar || '🍿',
    membersCount: members.length,
    maxMembers: room.maxMembers || 50,
    currentVideoTitle: room.currentVideoTitle || meta.title,
    currentVideoThumbnail: meta.thumbnail,
    videoUrl: room.videoUrl,
    provider: room.provider,
    playing: Boolean(room.playing || room.isPlaying),
    anyoneCanControl: room.anyoneCanControl !== false,
  };
}

/**
 * Seed initial sample featured rooms if no rooms exist yet
 */
export async function seedInitialRoomsIfEmpty(): Promise<void> {
  const dbRooms = await getAllRoomsFromDb();
  if (Object.keys(dbRooms).length > 0 || Object.keys(rooms).length > 0) {
    // Populate in-memory map from db
    for (const [id, r] of Object.entries(dbRooms)) {
      if (!rooms[id]) {
        rooms[id] = r;
      }
    }
    return;
  }

  const sampleRooms: CreateRoomPayload[] = [
    {
      roomId: 'LOFI',
      name: '🎧 Lofi Hip Hop Cafe • Чилаут & Учеба',
      description: 'Уютный синхронный просмотр и прослушивание расслабляющих битов.',
      tags: ['Музыка', 'YouTube', 'Relax', 'Lofi'],
      isPrivate: false,
      initialVideoUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      hostId: 'host_lofi',
      hostName: 'Lofi Girl',
      hostAvatar: '🎧',
      hostColor: '#a855f7',
      anyoneCanControl: false,
    },
    {
      roomId: 'CINEMA',
      name: '🍿 Кинозал Премьер • Новинки & Трейлеры',
      description: 'Смотрим главные трейлеры кино и новинки 2026 в 4K качестве.',
      tags: ['Кино', 'Трейлеры', 'YouTube', 'Премьеры'],
      isPrivate: false,
      initialVideoUrl: 'https://www.youtube.com/watch?v=1Roy4o4WCyE',
      hostId: 'host_cinema',
      hostName: 'Киноман',
      hostAvatar: '🍿',
      hostColor: '#f59e0b',
      anyoneCanControl: true,
    },
    {
      roomId: 'ANIME',
      name: '⚡ Аниме Клуб • Лучшие Опенинги & Эпизоды',
      description: 'Совместный просмотр эпичных аниме моментов и обсуждение в голосе.',
      tags: ['Аниме', 'VK Video', 'AMV', 'Сериалы'],
      isPrivate: false,
      initialVideoUrl: 'https://vkvideo.ru/video-220550000_456239149',
      hostId: 'host_anime',
      hostName: 'Otaku Senpai',
      hostAvatar: '🦊',
      hostColor: '#ec4899',
      anyoneCanControl: true,
    },
  ];

  for (const sample of sampleRooms) {
    await createRoom(sample);
  }
  console.log('[ROOMS] Seeded initial sample rooms for lobby.');
}

/**
 * List all active rooms with optional search / filter
 * Note: Never deletes empty rooms automatically on list!
 */
export async function listRooms(options?: {
  includePrivate?: boolean;
  tag?: string;
  search?: string;
  hostId?: string;
}): Promise<RoomSummary[]> {
  try {
    const dbRooms = await getAllRoomsFromDb();
    for (const [id, r] of Object.entries(dbRooms)) {
      if (!rooms[id]) {
        rooms[id] = r;
      }
    }
  } catch (err) {
    console.warn('[ROOMS] Error loading db rooms for list:', err);
  }

  let allList = Object.values(rooms).map(toRoomSummary);

  // If hostId provided, include that user's private rooms as well
  if (!options?.includePrivate) {
    allList = allList.filter((r) => !r.isPrivate || (options?.hostId && r.hostId === options.hostId));
  }

  if (options?.tag && options.tag !== 'Все') {
    const searchTag = options.tag.toLowerCase();
    allList = allList.filter(
      (r) => r.tags?.some((t) => t.toLowerCase() === searchTag) || r.provider?.toLowerCase() === searchTag
    );
  }

  if (options?.search && options.search.trim().length > 0) {
    const q = options.search.trim().toLowerCase();
    allList = allList.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.roomId.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.hostName.toLowerCase().includes(q) ||
        r.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }

  // Sort: most active (members) first, then recently created
  allList.sort((a, b) => {
    if (b.membersCount !== a.membersCount) {
      return b.membersCount - a.membersCount;
    }
    return b.createdAt - a.createdAt;
  });

  return allList;
}

/**
 * Find room by ID or Code from memory or PostgreSQL
 */
export async function getRoomByIdOrCode(identifier: string): Promise<RoomState | null> {
  const cleanId = normalizeRoomCode(identifier);
  if (!cleanId) return null;

  if (rooms[cleanId]) {
    return rooms[cleanId];
  }

  const dbRoom = await loadRoomFromDb(cleanId);
  if (dbRoom) {
    rooms[dbRoom.roomId] = dbRoom;
    return dbRoom;
  }

  return null;
}

/**
 * Explicit Room Creation
 * Persists to PostgreSQL and In-Memory registry
 */
export async function createRoom(payload: CreateRoomPayload): Promise<RoomState> {
  let roomId = payload.roomId ? normalizeRoomCode(payload.roomId) : generateRoomCode();
  if (!roomId || roomId.length < 2) {
    roomId = generateRoomCode();
  }

  console.log(`[ROOM_CREATE] Creating new room #${roomId} by hostId=${payload.hostId} (${payload.hostName})`);

  const cleanUrl = (payload.initialVideoUrl || 'https://www.youtube.com/watch?v=jfKfPfyJRdk').trim();
  let provider: VideoProvider = 'unknown';
  if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) provider = 'youtube';
  else if (cleanUrl.includes('vk.com') || cleanUrl.includes('vkvideo.ru')) provider = 'vk';
  else if (cleanUrl.includes('rutube.ru')) provider = 'rutube';
  else if (cleanUrl.startsWith('http')) provider = 'direct';

  const defaultRole = payload.defaultRole || 'member';

  const newRoom: RoomState = {
    roomId,
    name: payload.name?.trim() || `Зал #${roomId}`,
    description: payload.description?.trim() || '',
    isPrivate: Boolean(payload.isPrivate),
    password: payload.password?.trim() || undefined,
    tags: payload.tags && payload.tags.length > 0 ? payload.tags : ['Кино & Видео'],
    maxMembers: payload.maxMembers || 50,
    createdAt: Date.now(),
    hostId: payload.hostId,
    hostName: payload.hostName,
    hostAvatar: payload.hostAvatar || '🍿',
    videoUrl: cleanUrl,
    provider,
    currentTime: 0,
    playing: false,
    isPlaying: false,
    lastUpdated: Date.now(),
    members: {
      [payload.hostId]: {
        userId: payload.hostId,
        name: payload.hostName,
        avatar: payload.hostAvatar || '🍿',
        color: payload.hostColor || '#a855f7',
        isHost: true,
        role: 'host',
      },
    },
    chatHistory: [
      {
        id: `sys_create_${Date.now()}`,
        type: 'system',
        text: `Зал «${payload.name || roomId}» создан! Добро пожаловать.`,
        timestamp: Date.now(),
      },
    ],
    anyoneCanControl: payload.anyoneCanControl !== undefined ? payload.anyoneCanControl : true,
    defaultRole,
    bannedUserIds: [],
  };

  rooms[roomId] = newRoom;
  await saveRoomToDb(newRoom);

  console.log(`[ROOM_CREATE_SUCCESS] Room #${roomId} saved to PostgreSQL and memory.`);
  // Notify all lobby clients
  broadcastLobbyUpdate();

  return newRoom;
}

/**
 * Explicit Room Join with PostgreSQL verification
 * NEVER creates a room if it does not exist!
 */
export async function joinRoomBackend(params: {
  roomId: string;
  userId: string;
  name: string;
  avatar?: string;
  color?: string;
  password?: string;
}): Promise<{
  success: boolean;
  status: number;
  room?: RoomState;
  member?: Member;
  error?: string;
  code?: string;
}> {
  const cleanId = normalizeRoomCode(params.roomId);
  console.log(`[ROOM_JOIN_REQUEST] User ${params.userId} (${params.name}) requesting join to room #${cleanId}`);

  if (!cleanId) {
    return {
      success: false,
      status: 400,
      error: 'Некорректный код комнаты',
      code: 'INVALID_ROOM_CODE',
    };
  }

  // Authoritative lookup in PostgreSQL and memory
  const room = await getRoomByIdOrCode(cleanId);
  if (!room) {
    console.log(`[ROOM_NOT_FOUND] Join rejected: Room "${cleanId}" does not exist in PostgreSQL or memory.`);
    return {
      success: false,
      status: 404,
      error: `Комната #${cleanId} не найдена. Проверьте правильность кода или ссылки.`,
      code: 'ROOM_NOT_FOUND',
    };
  }

  // Check ban list
  if (room.bannedUserIds?.includes(params.userId)) {
    return {
      success: false,
      status: 403,
      error: 'Вы заблокированы в этой комнате.',
      code: 'USER_BANNED',
    };
  }

  // Check private room password
  if (room.isPrivate && room.password && room.password.length > 0) {
    const isHost = room.hostId === params.userId;
    if (!isHost) {
      if (!params.password || params.password.trim() !== room.password) {
        return {
          success: false,
          status: 401,
          error: 'Требуется пароль для входа в приватную комнату.',
          code: 'PASSWORD_REQUIRED',
        };
      }
    }
  }

  // Check room capacity
  const currentMemberCount = Object.keys(room.members || {}).length;
  const isAlreadyMember = Boolean(room.members?.[params.userId]);
  if (!isAlreadyMember && room.maxMembers && currentMemberCount >= room.maxMembers) {
    return {
      success: false,
      status: 403,
      error: `В комнате достигнут лимит участников (${room.maxMembers}).`,
      code: 'ROOM_FULL',
    };
  }

  // Determine role & host status
  const isHost = room.hostId === params.userId;
  const existingRole = room.members?.[params.userId]?.role;
  const role = isHost ? 'host' : (existingRole || room.defaultRole || 'member');

  const joinedMember: Member = {
    userId: params.userId,
    name: params.name || 'Гость',
    avatar: params.avatar || '🍿',
    color: params.color || '#a855f7',
    isHost,
    role,
  };

  room.members = room.members || {};
  room.members[params.userId] = joinedMember;

  // Persist updated membership to PostgreSQL
  await addMemberToDb(cleanId, joinedMember);
  await saveRoomToDb(room);

  console.log(`[ROOM_JOIN_SUCCESS] User ${params.userId} successfully joined room #${cleanId} as ${role} (isHost=${isHost})`);

  broadcastLobbyUpdate();

  return {
    success: true,
    status: 200,
    room,
    member: joinedMember,
  };
}

/**
 * Delete a room by host
 */
export async function deleteRoom(roomId: string, requesterUserId?: string): Promise<{ success: boolean; error?: string }> {
  const cleanId = normalizeRoomCode(roomId);
  const room = await getRoomByIdOrCode(cleanId);

  if (!room) {
    return { success: false, error: 'Комната не найдена' };
  }

  if (requesterUserId && room.hostId !== requesterUserId) {
    return { success: false, error: 'Только создатель комнаты может удалить её' };
  }

  // Kick connected clients and notify them
  const closeMessage = JSON.stringify({
    type: 'room_closed',
    roomId: cleanId,
    reason: 'Комната была удалена создателем.',
    message: 'Комната была удалена создателем.',
  });

  const altCloseMessage = JSON.stringify({
    type: 'room:closed',
    roomId: cleanId,
    reason: 'Комната была удалена создателем.',
  });

  for (const [ws, conn] of clientConnections.entries()) {
    if (conn.roomId === cleanId && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(closeMessage);
        ws.send(altCloseMessage);
        ws.close();
      } catch (e) {}
    }
  }

  delete rooms[cleanId];
  await deleteRoomFromDb(cleanId);

  // Notify lobby listeners
  broadcastLobbyUpdate();

  return { success: true };
}

/**
 * Verify passcode for private rooms
 */
export function verifyRoomPassword(roomId: string, passwordAttempt: string): boolean {
  const cleanId = normalizeRoomCode(roomId);
  const room = rooms[cleanId];
  if (!room || !room.isPrivate || !room.password) {
    return true; // No password required
  }
  return room.password === passwordAttempt.trim();
}

/**
 * Broadcast updated room list to all clients currently viewing the Lobby
 */
export async function broadcastLobbyUpdate() {
  if (lobbySubscribers.size === 0) return;

  try {
    const list = await listRooms();
    const payload = JSON.stringify({
      type: 'rooms:list_updated',
      rooms: list,
      timestamp: Date.now(),
    });

    for (const ws of lobbySubscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      } else {
        lobbySubscribers.delete(ws);
      }
    }
  } catch (err) {
    console.error('[ROOMS] Error broadcasting lobby update:', err);
  }
}
