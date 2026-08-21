import { JSONFilePreset } from "lowdb/node";
import { RoomState, ChatMessage, Member } from "./types";

export interface DatabaseSchema {
  rooms: Record<string, RoomState>;
}

const defaultData: DatabaseSchema = {
  rooms: {},
};

let dbPromise: Promise<any> | null = null;

export async function getDb() {
  if (!dbPromise) {
    dbPromise = JSONFilePreset<DatabaseSchema>("sferium_database.json", defaultData);
  }
  return await dbPromise;
}

export async function loadRoomFromDb(roomId: string): Promise<RoomState | null> {
  try {
    const db = await getDb();
    await db.read();
    return db.data.rooms[roomId] || null;
  } catch (err) {
    console.error("[DB] Error loading room:", err);
    return null;
  }
}

export async function saveRoomToDb(room: RoomState): Promise<void> {
  try {
    const db = await getDb();
    db.data.rooms[room.roomId] = { ...room };
    await db.write();
  } catch (err) {
    console.error("[DB] Error saving room:", err);
  }
}

export async function deleteRoomFromDb(roomId: string): Promise<void> {
  try {
    const db = await getDb();
    delete db.data.rooms[roomId];
    await db.write();
  } catch (err) {
    console.error("[DB] Error deleting room:", err);
  }
}

export async function getAllRoomsFromDb(): Promise<Record<string, RoomState>> {
  try {
    const db = await getDb();
    await db.read();
    return db.data.rooms || {};
  } catch (err) {
    console.error("[DB] Error getting all rooms:", err);
    return {};
  }
}
