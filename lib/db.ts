import { Pool, type PoolClient } from "pg";
import pgvector from "pgvector/pg";

let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({ connectionString });
    pool.on("connect", (client) => {
      // Registers the `vector` type so JS number[] <-> pgvector round-trips
      // without manual string formatting.
      void pgvector.registerType(client);
    });
  }
  return pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  try {
    const result = await getPool().query(text, params);
    return result.rows as T[];
  } catch (error) {
    console.warn("Database query failed; returning an empty result set.", error);
    return [] as T[];
  }
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  try {
    const client = await getPool().connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  } catch (error) {
    console.warn("Database client acquisition failed.", error);
    throw error;
  }
}

export { pgvector };
