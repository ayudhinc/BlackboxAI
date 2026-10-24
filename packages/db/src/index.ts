import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";
import { databaseUrl } from "./url.ts";

export { databaseUrl, LOCAL_DATABASE_URL } from "./url.ts";
export { schema };

export type Db = NodePgDatabase<typeof schema>;

export type DbHandle = { db: Db; close: () => Promise<void> };

export function connect(url: string = databaseUrl()): DbHandle {
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}
