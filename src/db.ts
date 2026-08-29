import { RoomState, Member } from "./types";
import { getPgPool, initPostgresSchema } from "./services/postgres";

// In-memory cache store
const memoryStore: Record<string, RoomState> = {};
let dbInitialized = false;

export function normalizeRoomCode(input: string): string {
  if (!input) return "";
  let str = input.trim();
  
  // 1. Try URL parsing if valid absolute URL
  try {
    if (str.startsWith("http://") || str.startsWith("https://")) {
      const parsedUrl = new URL(str);
      const queryRoom = parsedUrl.searchParams.get("room") || parsedUrl.searchParams.get("roomId");
      if (queryRoom) {
        return queryRoom.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
      }
      str = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
    }
  } catch {}

  // 2. Check for query parameter in relative URL or search string
  if (str.includes("room=") || str.includes("roomId=")) {
    const match = str.match(/(?:room|roomId)=([^&#]+)/i);
    if (match && match[1]) {
      return match[1].trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    }
  }

  // 3. Extract room ID from path patterns (/room/XYZ or /invite/XYZ)
  if (str.includes("/room/")) {
    str = str.split("/room/").pop() || "";
  } else if (str.includes("/invite/")) {
    str = str.split("/invite/").pop() || "";
  }

  // 4. Strip query parameters and hashes
  str = str.replace(/[?#].*$/, "");
  // 5. Strip leading/trailing slashes
  str = str.replace(/^\/+|\/+$/g, "");

  // 6. Remove any remaining URL slashes or path parts
  if (str.includes("/")) {
    str = str.split("/").pop() || "";
  }

  return str.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

async function ensureDb(): Promise<boolean> {
  if (dbInitialized) return true;
  dbInitialized = await initPostgresSchema();
  return dbInitialized;
}

/**
 * Load room from PostgreSQL (Source of Truth) or fallback memory store
 * Checks both room_id and code
 */
export async function loadRoomFromDb(identifier: string): Promise<RoomState | null> {
  const cleanId = normalizeRoomCode(identifier);
  if (!cleanId) return null;

  try {
    const isPgAvailable = await ensureDb();
    const pool = getPgPool();

    if (isPgAvailable && pool) {
      console.log(`[ROOM_LOOKUP] Searching PostgreSQL for room identifier="${cleanId}"`);
      const res = await pool.query(
        "SELECT room_id, code, host_id, data FROM rooms WHERE room_id = $1 OR code = $1 LIMIT 1",
        [cleanId]
      );
      if (res.rows.length > 0) {
        const room = res.rows[0].data as RoomState;
        
        // Also fetch active relational members from room_members table
        try {
          const membersRes = await pool.query(
            "SELECT user_id, name, avatar, color, is_host, role FROM room_members WHERE room_id = $1",
            [room.roomId || cleanId]
          );
          if (membersRes.rows.length > 0) {
            room.members = room.members || {};
            for (const row of membersRes.rows) {
              room.members[row.user_id] = {
                userId: row.user_id,
                name: row.name,
                avatar: row.avatar,
                color: row.color,
                isHost: row.is_host,
                role: row.role,
              };
            }
          }
        } catch (memErr: any) {
          console.warn(`[DB] Could not load relational members for ${cleanId}:`, memErr.message);
        }

        memoryStore[room.roomId] = room;
        console.log(`[ROOM_FOUND] Found room #${room.roomId} in PostgreSQL (hostId=${room.hostId}, membersCount=${Object.keys(room.members || {}).length})`);
        return room;
      }
      console.log(`[ROOM_NOT_FOUND] Room "${cleanId}" does NOT exist in PostgreSQL`);
      return null;
    }
  } catch (err: any) {
    console.warn(`[DB] Error loading room ${cleanId} from PostgreSQL:`, err.message);
  }

  // Fallback memory store lookup
  const room = memoryStore[cleanId] || null;
  if (room) {
    console.log(`[ROOM_FOUND] Found room #${cleanId} in memory store`);
  } else {
    console.log(`[ROOM_NOT_FOUND] Room "${cleanId}" does NOT exist in memory store`);
  }
  return room;
}

/**
 * Save / Update room in PostgreSQL and cache
 */
export async function saveRoomToDb(room: RoomState): Promise<void> {
  if (!room || !room.roomId) return;
  const cleanId = normalizeRoomCode(room.roomId);
  room.roomId = cleanId;
  memoryStore[cleanId] = { ...room };

  try {
    const isPgAvailable = await ensureDb();
    const pool = getPgPool();

    if (isPgAvailable && pool) {
      // 1. Save room record
      await pool.query(
        `INSERT INTO rooms (room_id, code, host_id, data, updated_at)
         VALUES ($1, $1, $2, $3, NOW())
         ON CONFLICT (room_id)
         DO UPDATE SET code = $1, host_id = $2, data = $3, updated_at = NOW()`,
        [cleanId, room.hostId || "", JSON.stringify(room)]
      );

      // 2. Sync members to room_members relational table
      if (room.members && Object.keys(room.members).length > 0) {
        for (const member of Object.values(room.members)) {
          if (member && member.userId) {
            await pool.query(
              `INSERT INTO room_members (room_id, user_id, name, avatar, color, is_host, role, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
               ON CONFLICT (room_id, user_id)
               DO UPDATE SET name = $3, avatar = $4, color = $5, is_host = $6, role = $7, updated_at = NOW()`,
              [
                cleanId,
                member.userId,
                member.name || "Гость",
                member.avatar || "🍿",
                member.color || "#a855f7",
                Boolean(member.isHost || member.userId === room.hostId),
                member.role || "member",
              ]
            );
          }
        }
      }
    }
  } catch (err: any) {
    console.warn(`[DB] Error saving room ${cleanId} to PostgreSQL:`, err.message);
  }
}

/**
 * Add or update a participant in PostgreSQL
 */
export async function addMemberToDb(roomId: string, member: Member): Promise<void> {
  const cleanId = normalizeRoomCode(roomId);
  if (!cleanId || !member || !member.userId) return;

  try {
    const isPgAvailable = await ensureDb();
    const pool = getPgPool();

    if (isPgAvailable && pool) {
      await pool.query(
        `INSERT INTO room_members (room_id, user_id, name, avatar, color, is_host, role, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (room_id, user_id)
         DO UPDATE SET name = $3, avatar = $4, color = $5, is_host = $6, role = $7, updated_at = NOW()`,
        [
          cleanId,
          member.userId,
          member.name || "Гость",
          member.avatar || "🍿",
          member.color || "#a855f7",
          Boolean(member.isHost),
          member.role || "member",
        ]
      );
      console.log(`[MEMBER_SAVED] Persisted member userId=${member.userId} in room #${cleanId}`);
    }
  } catch (err: any) {
    console.warn(`[DB] Error saving member ${member.userId} for room ${cleanId}:`, err.message);
  }
}

/**
 * Remove a participant from PostgreSQL
 */
export async function removeMemberFromDb(roomId: string, userId: string): Promise<void> {
  const cleanId = normalizeRoomCode(roomId);
  if (!cleanId || !userId) return;

  try {
    const isPgAvailable = await ensureDb();
    const pool = getPgPool();

    if (isPgAvailable && pool) {
      await pool.query(
        "DELETE FROM room_members WHERE room_id = $1 AND user_id = $2",
        [cleanId, userId]
      );
      console.log(`[MEMBER_REMOVED] Removed member userId=${userId} from room #${cleanId}`);
    }
  } catch (err: any) {
    console.warn(`[DB] Error removing member ${userId} from room ${cleanId}:`, err.message);
  }
}

/**
 * Delete a room from PostgreSQL (cascades to room_members)
 */
export async function deleteRoomFromDb(roomId: string): Promise<void> {
  const cleanId = normalizeRoomCode(roomId);
  delete memoryStore[cleanId];

  try {
    const isPgAvailable = await ensureDb();
    const pool = getPgPool();

    if (isPgAvailable && pool) {
      await pool.query("DELETE FROM rooms WHERE room_id = $1 OR code = $1", [cleanId]);
      console.log(`[ROOM_DELETED] Room #${cleanId} deleted from PostgreSQL`);
    }
  } catch (err: any) {
    console.warn(`[DB] Error deleting room ${cleanId} from PostgreSQL:`, err.message);
  }
}

/**
 * Fetch all persistent rooms from PostgreSQL
 */
export async function getAllRoomsFromDb(): Promise<Record<string, RoomState>> {
  try {
    const isPgAvailable = await ensureDb();
    const pool = getPgPool();

    if (isPgAvailable && pool) {
      const res = await pool.query("SELECT room_id, data FROM rooms");
      const loadedRooms: Record<string, RoomState> = {};
      for (const row of res.rows) {
        if (row.data && row.room_id) {
          const room = row.data as RoomState;
          loadedRooms[row.room_id] = room;
          memoryStore[row.room_id] = room;
        }
      }
      return loadedRooms;
    }
  } catch (err: any) {
    console.warn("[DB] Error fetching all rooms from PostgreSQL:", err.message);
  }

  return { ...memoryStore };
}
