import pg from "pg";
const { Pool } = pg;

let pool: pg.Pool | null = null;
let isSchemaInitialized = false;

export function getPgPool(): pg.Pool | null {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    return null;
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err) => {
      console.warn("[PostgreSQL] Unexpected client pool error:", err.message);
    });
  }
  return pool;
}

export async function initPostgresSchema(): Promise<boolean> {
  if (isSchemaInitialized) return true;
  const p = getPgPool();
  if (!p) {
    console.log("[PostgreSQL] POSTGRES_URL not provided, falling back to local memory store.");
    return false;
  }

  try {
    const client = await p.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS rooms (
          room_id VARCHAR(128) PRIMARY KEY,
          code VARCHAR(128) UNIQUE,
          host_id VARCHAR(128),
          data JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Safe column additions if table already existed
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS code VARCHAR(128);
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS host_id VARCHAR(128);
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms (code);
        CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms (updated_at);
        CREATE INDEX IF NOT EXISTS idx_rooms_host_id ON rooms (host_id);

        -- Room members table for participant relational persistence
        CREATE TABLE IF NOT EXISTS room_members (
          room_id VARCHAR(128) NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
          user_id VARCHAR(128) NOT NULL,
          name VARCHAR(255),
          avatar VARCHAR(64),
          color VARCHAR(64),
          is_host BOOLEAN DEFAULT FALSE,
          role VARCHAR(64) DEFAULT 'member',
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          PRIMARY KEY (room_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members (room_id);
        CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members (user_id);
      `);
      isSchemaInitialized = true;
      console.log("[PostgreSQL] Schema successfully initialized / verified.");
      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn("[PostgreSQL] Failed to initialize PostgreSQL table:", err.message);
    return false;
  }
}
