/**
 * Day-1 probe: SAM 3.1 video tracking on one sandbox recording.
 * Usage: pnpm --filter @blackbox/scripts probe:sam <clip.mp4> [phrase ...]
 * Billed per frame and phrase. Writes lineage rows, and the parsed tracks to
 * recordings/probe/<clip>.<phrase>.tracks.json.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { connect } from "@blackbox/db";
import {
  createMetaTransport,
  DbLineageSink,
  MetaClient,
  probeVideo,
  tracksFromSam,
} from "@blackbox/engine";
import { loadEnv, ROOT } from "./env.ts";

loadEnv();
const [path, ...phraseArgs] = process.argv.slice(2);
if (!path) throw new Error("Usage: probe-sam <clip.mp4> [phrase ...]");
const phrases = phraseArgs.length > 0 ? phraseArgs : ["cursor", "modal dialog", "error banner"];

const info = await probeVideo(path);
console.log(
  `clip ${basename(path)}: ${info.codec} ${info.width}x${info.height} ${info.fps.toFixed(2)} fps, ${info.frames} frames, ${info.durationMs} ms`,
);
const { db, close } = connect();
try {
  const client = new MetaClient(createMetaTransport(), new DbLineageSink(db));
  const fileId = await client.uploadFile({
    bytes: await readFile(path),
    filename: basename(path),
    mimeType: "video/mp4",
  });
  console.log(`uploaded as ${fileId}`);
  const outDir = `${ROOT}recordings/probe`;
  await mkdir(outDir, { recursive: true });

  for (const phrase of phrases) {
    const started = performance.now();
    const { result, framesProcessed } = await client.samVideo({
      subject: { stage: "probe" },
      fileId,
      phrase,
    });
    const tracks = tracksFromSam("probe", phrase, result, info.fps);
    const boxes = tracks.reduce((n, t) => n + t.frames.length, 0);
    const out = `${outDir}/${basename(path, ".mp4")}.${phrase.replaceAll(" ", "-")}.tracks.json`;
    await writeFile(
      out,
      JSON.stringify({ phrase, framesProcessed, diagnostics: result.diagnostics, tracks }, null, 2),
    );
    console.log(
      `${phrase}: ${tracks.length} object(s), ${boxes} boxes over ${framesProcessed} frames processed, ${result.diagnostics.length} diagnostics, ${Math.round(performance.now() - started)} ms -> ${out}`,
    );
  }
} finally {
  await close();
}
