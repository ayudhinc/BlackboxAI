import "server-only";
import { connect, type Db } from "@blackbox/db";
import { type BlobStore, storeFromEnv } from "@blackbox/engine";

// One pool and one store per server process; Next.js dev reloads keep them on globalThis.
const g = globalThis as unknown as { __bbDb?: Db; __bbStore?: BlobStore };

export function db(): Db {
  g.__bbDb ??= connect().db;
  return g.__bbDb;
}

export function store(): BlobStore {
  g.__bbStore ??= storeFromEnv();
  return g.__bbStore;
}
