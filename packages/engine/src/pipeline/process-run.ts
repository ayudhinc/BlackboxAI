/**
 * The verification pipeline for one run: ingest -> track -> narrate -> check
 * -> verdict. Each stage records its status and lineage; a failure stops the
 * run with a message that says whose failure it was.
 */
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Rule, Step, UiTrack } from "@blackbox/contracts";
import type { Db } from "@blackbox/db";
import { runChecks } from "../check/checkers.ts";
import { FRAME_MS, ingest } from "../ingest/ingest.ts";
import type { MetaClient } from "../meta/client.ts";
import { MetaCallError } from "../meta/errors.ts";
import { type LineageSink, lineageEntry } from "../meta/lineage.ts";
import { narrate, toSteps } from "../narrate/narrate.ts";
import { mapRuntimeEvents, parseRuntimeJsonl } from "../native/map-events.ts";
import { type BlobStore, keys } from "../store/blob.ts";
import { tracksFromSam } from "../track/sam-tracks.ts";
import { decide, judge } from "../verdict/verdict.ts";
import {
  insertVerdict,
  loadRules,
  loadRun,
  replaceSteps,
  replaceTracks,
  replaceViolations,
  setRunStatus,
} from "./repo.ts";

/** SAM phrases that tracked reliably in the day-1 go/no-go; see docs/decisions.md. */
export const TRACK_PHRASES = ["cursor", "button"] as const;

export type PipelineDeps = {
  db: Db;
  client: MetaClient;
  lineage: LineageSink;
  store: BlobStore;
  workRoot: string;
  log?: (message: string) => void;
};

export async function processRun(deps: PipelineDeps, runId: string): Promise<void> {
  const { db, client, lineage, store } = deps;
  const log = deps.log ?? (() => {});
  const run = await loadRun(db, runId);
  const workDir = join(deps.workRoot, runId);
  await mkdir(workDir, { recursive: true });

  try {
    // Refuse before spending anything if the policy is not signed off.
    const rules: Rule[] = run.policyId ? await loadRules(db, run.policyId) : [];
    const unsigned = rules.filter((r) => r.status !== "ready" || r.signedOffBy === null);
    if (unsigned.length > 0) {
      throw new InputError(
        `The policy has rules that are not signed off (${unsigned.map((r) => r.id).join(", ")}). Resolve and sign off the policy, then rerun.`,
      );
    }

    await setRunStatus(db, runId, "ingesting");
    const started = performance.now();
    const recording = join(workDir, "recording.mp4");
    await store.download(keys.recording(runId), recording);
    let media: Awaited<ReturnType<typeof ingest>>;
    try {
      media = await ingest(recording, workDir);
    } catch (error) {
      throw new InputError(`The recording could not be read: ${(error as Error).message}`);
    }
    for (const frame of media.keyframes) {
      await store.put(
        keys.frame(runId, frame),
        await readFile(media.framePath(frame)),
        "image/jpeg",
      );
    }
    await setRunStatus(db, runId, "ingesting", { durationMs: media.info.durationMs });
    await lineage.write(
      lineageEntry(
        { stage: "ingest", runId },
        {
          engine: "ffmpeg",
          frames: media.frameCount,
          costUsd: 0,
          latencyMs: Math.round(performance.now() - started),
          attempt: 1,
        },
      ),
    );
    log(
      `ingest: ${media.frameCount} frames, ${media.keyframes.length} keyframes, ${media.chunks.length} chunk(s)`,
    );

    let steps: Step[];
    let agentClaim: string | null = null;
    if (run.mode === "native") {
      await setRunStatus(db, runId, "narrating");
      const events = parseRuntimeJsonl(
        runId,
        (await store.get(keys.runtimeEvents(runId))).toString("utf8"),
      );
      ({ steps, agentClaim } = mapRuntimeEvents(runId, events, media.signatures, FRAME_MS));
      log(`map events: ${events.length} runtime events -> ${steps.length} steps`);
    } else {
      await setRunStatus(db, runId, "tracking");
      const tracks: UiTrack[] = [];
      for (const chunk of media.chunks) {
        const fileId = await client.uploadFile({
          bytes: await readFile(chunk.samClipPath),
          filename: `${runId}-chunk-${chunk.index}.mp4`,
          mimeType: "video/mp4",
        });
        for (const phrase of TRACK_PHRASES) {
          const { result } = await client.samVideo({
            subject: { stage: "track", runId },
            fileId,
            phrase,
          });
          for (const t of tracksFromSam(runId, phrase, result, 1000 / FRAME_MS)) {
            tracks.push({
              ...t,
              objectId: `${chunk.index}:${t.objectId}`,
              frames: t.frames.map((f) => ({
                ...f,
                frame: f.frame + chunk.startFrame,
                tMs: f.tMs + chunk.startMs,
              })),
            });
          }
        }
      }
      await replaceTracks(db, runId, tracks);
      log(`track: ${tracks.length} tracks`);

      await setRunStatus(db, runId, "narrating");
      const narration = await narrate(client, runId, {
        task: run.task,
        keyframes: media.keyframes,
        frameMs: FRAME_MS,
        framePath: media.framePath,
        tracks,
      });
      steps = toSteps(runId, narration, media.keyframes, media.signatures, FRAME_MS);
      agentClaim = narration.agentClaim;
      log(`narrate: ${steps.length} steps`);
    }
    await replaceSteps(db, runId, steps);

    await setRunStatus(db, runId, "checking", { agentClaim });
    const checkStarted = performance.now();
    const violations = runChecks(rules, steps, { runId, durationMs: media.info.durationMs });
    await lineage.write(
      lineageEntry(
        { stage: "check", runId },
        {
          engine: "checkers",
          costUsd: 0,
          latencyMs: Math.round(performance.now() - checkStarted),
          attempt: 1,
        },
      ),
    );
    log(`check: ${violations.length} finding(s)`);

    await setRunStatus(db, runId, "verdict");
    const judgement = await judge(client, runId, {
      task: run.task,
      steps,
      violations,
      agentClaim,
      keyframes: media.keyframes,
      framePath: media.framePath,
    });
    const claimStep = steps.find((s) => s.action === "claim");
    const { verdict, extra } = decide(runId, judgement, violations, rules, claimStep);
    // Frames the verdict cites must be in storage for the review page.
    for (const frame of verdict.evidenceFrames) {
      if (!media.keyframes.includes(frame)) {
        await store.put(
          keys.frame(runId, frame),
          await readFile(media.framePath(frame)),
          "image/jpeg",
        );
      }
    }
    await replaceViolations(db, runId, [...violations, ...extra]);
    await insertVerdict(db, verdict);
    await setRunStatus(db, runId, "done", { failure: null });
    log(
      `verdict: ${verdict.status} (proposed ${verdict.proposedStatus}, confidence ${verdict.confidence})`,
    );
  } catch (error) {
    await setRunStatus(db, runId, "failed", { failure: userFacing(error) });
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/** A problem with what the user gave us, reported with the exact reason. */
export class InputError extends Error {
  override readonly name = "InputError";
}

/** Say whose failure it was; never blame the user for ours, never leak internal ids. */
export function userFacing(error: unknown): string {
  if (error instanceof InputError) return error.message;
  if (error instanceof MetaCallError) {
    if (error.party === "input")
      return `The recording was rejected by the analysis service: ${error.message}`;
    if (error.party === "provider")
      return "The analysis service failed while verifying this run. This is not a problem with your recording. Retry the run.";
    return "BlackboxAI failed while verifying this run. This is our problem, not your recording's. It has been logged.";
  }
  return "BlackboxAI failed while verifying this run. This is our problem, not your recording's. It has been logged.";
}
