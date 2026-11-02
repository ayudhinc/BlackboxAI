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
 * R2 when R2_BUCKET is set, local disk otherwise. In production a missing R2
 * configuration is a deploy error, never a silent fallback to local disk.
 */
export function storeFromEnv(env: NodeJS.ProcessEnv = process.env): BlobStore {
  if (env.R2_BUCKET) {
    const need = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"].filter(
      (k) => !env[k],
    );
    if (need.length > 0) throw new Error(`R2 is configured but missing ${need.join(", ")}`);
    return new R2BlobStore({
      accountId: env.R2_ACCOUNT_ID as string,
      accessKeyId: env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
      bucket: env.R2_BUCKET,
    });
  }
  if (env.NODE_ENV === "production")
    throw new Error("R2_BUCKET is not set. Production never stores on local disk.");
  return new LocalBlobStore(
    env.BLOB_LOCAL_DIR ?? join(/* turbopackIgnore: true */ repoRoot(), ".data", "blobs"),
  );
}
