/**
 * Rooms Management Module for Sferium Homes Sync (AI Studio / Express)
 * Provides comprehensive Room lifecycle management:
 * - List active public/private rooms
 * - Create new room with custom metadata (name, tags, privacy, password, video)
 * - Delete room with host authority
 * - Verify private room passcodes
 * - Broadcast updates to lobby subscribers
 */

import { WebSocket } from 'ws';
import { RoomState, RoomSummary, CreateRoomPayload, VideoProvider } from '../../src/types';
import { loadRoomFromDb, saveRoomToDb, deleteRoomFromDb, getAllRoomsFromDb } from '../../src/db';
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
 */
export async function listRooms(options?: {
  includePrivate?: boolean;
  tag?: string;
  search?: string;
  hostId?: string;
}): Promise<RoomSummary[]> {
  // Sync db rooms to in-memory map while pruning any 0-member abandoned rooms
  try {
    const dbRooms = await getAllRoomsFromDb();
    for (const [id, r] of Object.entries(dbRooms)) {
      const memberCount = r.members ? Object.keys(r.members).length : 0;
      if (memberCount > 0) {
        if (!rooms[id]) {
          rooms[id] = r;
        }
      } else {
        // Automatically prune empty room from DB and memory
        delete rooms[id];
        await deleteRoomFromDb(id);
      }
    }
  } catch (err) {
    console.warn('[ROOMS] Error checking db rooms:', err);
  }

  // Filter out any in-memory rooms that have 0 members
  for (const [id, r] of Object.entries(rooms)) {
    const memberCount = r.members ? Object.keys(r.members).length : 0;
    if (memberCount === 0) {
      delete rooms[id];
      deleteRoomFromDb(id).catch(() => {});
    }
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
 * Create a new Room and persist to memory + DB
 */
export async function createRoom(payload: CreateRoomPayload): Promise<RoomState> {
  let roomId = payload.roomId ? payload.roomId.trim().toUpperCase() : generateRoomCode();
  roomId = roomId.replace(/[^A-Z0-9_-]/gi, '').toUpperCase();
  if (!roomId || roomId.length < 2) {
    roomId = generateRoomCode();
  }

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
    playing: true,
    isPlaying: true,
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

  // Notify all lobby clients
  broadcastLobbyUpdate();

  return newRoom;
}

/**
 * Delete a room by host
 */
export async function deleteRoom(roomId: string, requesterUserId?: string): Promise<{ success: boolean; error?: string }> {
  const cleanId = roomId.toUpperCase();
  const room = rooms[cleanId] || (await loadRoomFromDb(cleanId));

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
  const cleanId = roomId.toUpperCase();
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
