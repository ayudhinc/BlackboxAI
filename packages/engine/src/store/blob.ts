/**
 * Object storage for recordings, frames and evidence packs. Local disk in
 * development; Cloudflare R2 in production (same interface).
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export interface BlobStore {
  /**
   * Which backend this is. Branch on this, never on instanceof: Next.js dev
   * reloads keep a store on globalThis across copies of these classes, so an
   * instanceof check silently fails after any reload.
   */
  readonly kind: "local" | "r2";
  put(key: string, body: Uint8Array | string, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** Copy a stored object to a local file (the pipeline needs files for ffmpeg). */
  download(key: string, path: string): Promise<void>;
}

export class LocalBlobStore implements BlobStore {
  readonly kind = "local" as const;
  constructor(private readonly root: string) {}

  private path(key: string): string {
    const p = resolve(this.root, key);
    if (!p.startsWith(resolve(this.root))) throw new Error(`Blob key escapes the store: ${key}`);
    return p;
  }

  async put(key: string, body: Uint8Array | string, _contentType?: string): Promise<void> {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.path(key));
  }

  async download(key: string, path: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await copyFile(this.path(key), path);
  }
}

export const keys = {
  recording: (runId: string) => `runs/${runId}/recording.mp4`,
  frame: (runId: string, frame: number) =>
    `runs/${runId}/frames/${String(frame).padStart(6, "0")}.jpg`,
  runtimeEvents: (runId: string) => `runs/${runId}/runtime.jsonl`,
  evidence: (runId: string) => `runs/${runId}/evidence.json`,
  policy: (policyId: string, filename: string) => `policies/${policyId}/${filename}`,
};

export function defaultLocalStore(repoRoot: string): LocalBlobStore {
  return new LocalBlobStore(join(repoRoot, ".data", "blobs"));
}
