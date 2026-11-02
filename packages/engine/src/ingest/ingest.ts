/**
 * Stage 1, ingest: one recording in, a uniform 2 fps timeline out. Frames are
 * JPEGs for evidence and narration; SAM gets 2 fps H.264 clips of at most ten
 * minutes each.
 */
import { execFile } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  changedPixels,
  DEFAULT_KEYFRAMES,
  DIFF_H,
  DIFF_W,
  screenSignature,
  selectKeyframes,
  THUMB_H,
  THUMB_W,
} from "./frames.ts";
import { probeVideo, type VideoInfo } from "./probe.ts";

const run = promisify(execFile);

export const SAMPLE_FPS = 2;
export const FRAME_MS = 1000 / SAMPLE_FPS;
/** SAM takes at most 15,000 frames per request; ten-minute chunks keep far inside it. */
export const CHUNK_MS = 10 * 60 * 1000;

export type Chunk = {
  index: number;
  startFrame: number;
  endFrame: number; // exclusive
  startMs: number;
  samClipPath: string;
};

export type IngestResult = {
  info: VideoInfo;
  frameCount: number;
  framePath: (frame: number) => string;
  signatures: string[];
  keyframes: number[];
  /** Did the screen visibly change between two frames? Same metric as keyframe selection. */
  changed: (from: number, to: number) => boolean;
  chunks: Chunk[];
};

export async function ingest(recordingPath: string, workDir: string): Promise<IngestResult> {
  const info = await probeVideo(recordingPath);
  const framesDir = join(workDir, "frames");
  await mkdir(framesDir, { recursive: true });

  await ffmpeg([
    "-i",
    recordingPath,
    "-vf",
    `fps=${SAMPLE_FPS}`,
    "-q:v",
    "3",
    join(framesDir, "%06d.jpg"),
  ]);
  const frameCount = (await readdir(framesDir)).filter((f) => f.endsWith(".jpg")).length;
  if (frameCount === 0) throw new Error("The recording produced no frames.");

  const thumbs = await grayThumbs(recordingPath, THUMB_W, THUMB_H);
  const diffThumbs = await grayThumbs(recordingPath, DIFF_W, DIFF_H);
  if (thumbs.length !== frameCount || diffThumbs.length !== frameCount) {
    throw new Error(
      `Frame count mismatch: ${frameCount} JPEGs, ${thumbs.length} and ${diffThumbs.length} thumbnails.`,
    );
  }

  const framesPerChunk = (CHUNK_MS / 1000) * SAMPLE_FPS;
  const chunks: Chunk[] = [];
  for (let start = 0, index = 0; start < frameCount; start += framesPerChunk, index++) {
    const end = Math.min(frameCount, start + framesPerChunk);
    const samClipPath = join(workDir, `chunk-${index}.mp4`);
    await ffmpeg([
      "-ss",
      String((start * FRAME_MS) / 1000),
      "-t",
      String(((end - start) * FRAME_MS) / 1000),
      "-i",
      recordingPath,
      "-vf",
      `fps=${SAMPLE_FPS}`,
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      samClipPath,
    ]);
    chunks.push({
      index,
      startFrame: start,
      endFrame: end,
      startMs: start * FRAME_MS,
      samClipPath,
    });
  }

  return {
    info,
    frameCount,
    framePath: (frame) => join(framesDir, `${String(frame + 1).padStart(6, "0")}.jpg`),
    signatures: thumbs.map(screenSignature),
    keyframes: selectKeyframes(diffThumbs, DEFAULT_KEYFRAMES),
    changed: (from, to) => {
      const a = diffThumbs[from];
      const b = diffThumbs[to];
      if (!a || !b) return true;
      return changedPixels(a, b, DEFAULT_KEYFRAMES.levels) >= DEFAULT_KEYFRAMES.minChanged;
    },
    chunks,
  };
}

/** Decode the recording at SAMPLE_FPS into grayscale thumbnails of one size. */
async function grayThumbs(path: string, w: number, h: number): Promise<Uint8Array[]> {
  const { stdout } = await run(
    "ffmpeg",
    [
      "-loglevel",
      "error",
      "-i",
      path,
      "-vf",
      `fps=${SAMPLE_FPS},scale=${w}:${h}:flags=area,format=gray`,
      "-f",
      "rawvideo",
      "-",
    ],
    { encoding: "buffer", maxBuffer: 1024 * 1024 * 1024 },
  );
  const size = w * h;
  const out: Uint8Array[] = [];
  for (let i = 0; i + size <= stdout.length; i += size) out.push(stdout.subarray(i, i + size));
  return out;
}

async function ffmpeg(args: string[]): Promise<void> {
  try {
    await run("ffmpeg", ["-loglevel", "error", "-y", ...args], { maxBuffer: 1024 * 1024 * 16 });
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim();
    throw new Error(`ffmpeg failed: ${stderr || (error as Error).message}`);
  }
}
