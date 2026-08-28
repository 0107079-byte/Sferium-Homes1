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
          data JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms (updated_at);
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
