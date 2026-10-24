/** The compose Postgres from docker-compose.yml, port 5476 in ~/dev/ports.md. */
export const LOCAL_DATABASE_URL = "postgres://blackbox:blackbox@127.0.0.1:5476/blackbox";

/**
 * Resolve the database URL. Locally an unset DATABASE_URL means the compose
 * Postgres, never a remote one. In production an unset value is a deploy error
 * and fails loudly instead of falling back.
 */
export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL?.trim();
  if (url) return url;
  if (env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is not set. Production never falls back to a local database.");
  }
  return LOCAL_DATABASE_URL;
}
