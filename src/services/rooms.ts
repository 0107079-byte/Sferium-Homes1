import { RoomSummary, CreateRoomPayload, RoomState, Member } from '../types';

export interface GetRoomsOptions {
  tag?: string;
  search?: string;
  hostId?: string;
  includePrivate?: boolean;
}

/**
 * Fetch list of rooms from the REST API
 */
export async function fetchRoomsApi(options?: GetRoomsOptions): Promise<RoomSummary[]> {
  try {
    const params = new URLSearchParams();
    if (options?.tag && options.tag !== 'Все') params.append('tag', options.tag);
    if (options?.search) params.append('search', options.search);
    if (options?.hostId) params.append('hostId', options.hostId);
    if (options?.includePrivate) params.append('includePrivate', 'true');

    const res = await fetch(`/api/rooms?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch rooms: ${res.statusText}`);
    }
    const data = await res.json();
    return data.rooms || [];
  } catch (err) {
    console.warn('[Rooms Service] Error fetching rooms:', err);
    return [];
  }
}

/**
 * Fetch a single room info by ID or Code
 */
export async function fetchRoomByIdApi(roomId: string): Promise<{ success: boolean; room?: any; error?: string; notFound?: boolean }> {
  try {
    const cleanId = roomId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const res = await fetch(`/api/rooms/${encodeURIComponent(cleanId)}`);
    const data = await res.json();

    if (res.status === 404) {
      return { success: false, notFound: true, error: data.message || `Комната #${cleanId} не найдена` };
    }

    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Ошибка получения информации о комнате' };
    }

    return { success: true, room: data.room };
  } catch (err: any) {
    return { success: false, error: err.message || 'Сетевая ошибка' };
  }
}

/**
 * Explicitly join room via REST API with PostgreSQL validation
 * NEVER creates a room if it does not exist!
 */
export async function joinRoomApi(
  roomId: string,
  userPayload: {
    userId: string;
    name: string;
    avatar?: string;
    color?: string;
    password?: string;
  }
): Promise<{
  success: boolean;
  room?: RoomState;
  member?: Member;
  roomId?: string;
  error?: string;
  code?: string;
  notFound?: boolean;
}> {
  try {
    const cleanId = roomId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const res = await fetch(`/api/rooms/${encodeURIComponent(cleanId)}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userPayload),
    });

    const data = await res.json();

    if (res.status === 404 || data.code === 'ROOM_NOT_FOUND') {
      return {
        success: false,
        notFound: true,
        code: 'ROOM_NOT_FOUND',
        error: data.error || `Комната #${cleanId} не найдена. Проверьте ссылку или код.`,
      };
    }

    if (!res.ok || !data.success) {
      return {
        success: false,
        code: data.code,
        error: data.error || 'Не удалось присоединиться к комнате',
      };
    }

    return {
      success: true,
      room: data.room,
      member: data.member,
      roomId: data.roomId || cleanId,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Ошибка соединения с сервером',
    };
  }
}

/**
 * Create a new room via REST API (EXPLICIT CREATE)
 */
export async function createRoomApi(payload: CreateRoomPayload): Promise<{ success: boolean; room?: RoomState; roomId?: string; error?: string }> {
  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Не удалось создать комнату' };
    }
    return { success: true, room: data.room, roomId: data.roomId };
  } catch (err: any) {
    return { success: false, error: err.message || 'Сетевая ошибка при создании комнаты' };
  }
}

/**
 * Delete a room by host via REST API
 */
export async function deleteRoomApi(roomId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanId = roomId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const res = await fetch(`/api/rooms/${encodeURIComponent(cleanId)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({ userId }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Не удалось удалить комнату' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Сетевая ошибка при удалении комнаты' };
  }
}

/**
 * Verify passcode for private room
 */
export async function verifyRoomPasswordApi(roomId: string, passwordAttempt: string): Promise<boolean> {
  try {
    const cleanId = roomId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const res = await fetch(`/api/rooms/${encodeURIComponent(cleanId)}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: passwordAttempt }),
    });

    const data = await res.json();
    return res.ok && data.success;
  } catch (err) {
    console.error('[Rooms Service] Error verifying password:', err);
    return false;
  }
}
