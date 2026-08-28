import { RoomState } from "./types";
import { getPgPool, initPostgresSchema } from "./services/postgres";

// In-memory cache / fallback store for instant lookup and resilience
const memoryStore: Record<string, RoomState> = {};
let dbInitialized = false;

async function ensureDb(): Promise<boolean> {
  if (dbInitialized) return true;
  dbInitialized = await initPostgresSchema();
  return dbInitialized;
}

export async function loadRoomFromDb(roomId: string): Promise<RoomState | null> {
  try {
    const isPgAvailable = await ensureDb();
    const pool = getPgPool();

    if (isPgAvailable && pool) {
      const res = await pool.query("SELECT data FROM rooms WHERE room_id = $1", [roomId]);
      if (res.rows.length > 0) {
        const room = res.rows[0].data as RoomState;
        memoryStore[roomId] = room;
        return room;
      }
      return null;
    }
  } catch (err: any) {
    console.warn(`[DB] Error loading room ${roomId} from PostgreSQL:`, err.message);
  }

  return memoryStore[roomId] || null;
}

export async function saveRoomToDb(room: RoomState): Promise<void> {
  if (!room || !room.roomId) return;
  memoryStore[room.roomId] = { ...room };

  try {
    const isPgAvailable = await ensureDb();
    const pool = getPgPool();

    if (isPgAvailable && pool) {
      await pool.query(
        `INSERT INTO rooms (room_id, data, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (room_id)
         DO UPDATE SET data = $2, updated_at = NOW()`,
        [room.roomId, JSON.stringify(room)]
      );
    }
  } catch (err: any) {
    console.warn(`[DB] Error saving room ${room.roomId} to PostgreSQL:`, err.message);
  }
}

export async function deleteRoomFromDb(roomId: string): Promise<void> {
  delete memoryStore[roomId];

  try {
    const isPgAvailable = await ensureDb();
    const pool = getPgPool();

    if (isPgAvailable && pool) {
      await pool.query("DELETE FROM rooms WHERE room_id = $1", [roomId]);
    }
  } catch (err: any) {
    console.warn(`[DB] Error deleting room ${roomId} from PostgreSQL:`, err.message);
  }
}

export async function getAllRoomsFromDb(): Promise<Record<string, RoomState>> {
  try {
    const isPgAvailable = await ensureDb();
    const pool = getPgPool();

    if (isPgAvailable && pool) {
      const res = await pool.query("SELECT room_id, data FROM rooms");
      const rooms: Record<string, RoomState> = {};
      for (const row of res.rows) {
        if (row.data && row.room_id) {
          rooms[row.room_id] = row.data as RoomState;
          memoryStore[row.room_id] = row.data as RoomState;
        }
      }
      return rooms;
    }
  } catch (err: any) {
    console.warn("[DB] Error fetching all rooms from PostgreSQL:", err.message);
  }

  return { ...memoryStore };
}
