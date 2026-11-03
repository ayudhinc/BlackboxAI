import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { type BlobStore, LocalBlobStore } from "./blob.ts";
import { R2BlobStore } from "./r2.ts";

/** The repository root: the nearest directory holding pnpm-workspace.yaml. */
export function repoRoot(from = process.cwd()): string {
  let dir = resolve(/* turbopackIgnore: true */ from);
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const up = dirname(dir);
    if (up === dir) throw new Error("Could not find the repository root (pnpm-workspace.yaml)");
    dir = up;
  }
  return dir;
}

/**
 * Production stores in R2 and refuses to fall back to local disk. Development
 * stores on local disk unless BLOB_STORE=r2, so R2 keys sitting in the root
 * .env never split a local web app (disk) from a local worker (R2).
 */
export function storeFromEnv(env: NodeJS.ProcessEnv = process.env): BlobStore {
  const useR2 = env.NODE_ENV === "production" || env.BLOB_STORE === "r2";
  if (useR2) {
    const need = ["R2_BUCKET", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"].filter(
      (k) => !env[k],
    );
    if (need.length > 0)
      throw new Error(
        `R2 storage is required (production, or BLOB_STORE=r2) but ${need.join(", ")} is not set.`,
      );
    return new R2BlobStore({
      accountId: env.R2_ACCOUNT_ID as string,
      accessKeyId: env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
      bucket: env.R2_BUCKET as string,
    });
  }
  return new LocalBlobStore(
    env.BLOB_LOCAL_DIR ?? join(/* turbopackIgnore: true */ repoRoot(), ".data", "blobs"),
  );
}

/** R2 narrowing by kind; see BlobStore.kind for why not instanceof. */
export function isR2(s: BlobStore): s is R2BlobStore {
  return s.kind === "r2";
}

export function isLocal(s: BlobStore): s is LocalBlobStore {
  return s.kind === "local";
}
