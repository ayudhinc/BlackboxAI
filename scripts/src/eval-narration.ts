/**
 * Score video-mode narration against the scripted runs' ground truth.
 *   pnpm eval-narration
 * For each recordings/demo/<id>.truth.json, finds the latest finished
 * video-mode run of the same task text and scores its steps. Not billed.
 */
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { connect, schema } from "@blackbox/db";
import { loadSteps, scoreNarration, type TruthStep } from "@blackbox/engine";
import { and, desc, eq, like } from "drizzle-orm";
import { loadEnv, ROOT } from "./env.ts";

loadEnv();
const dir = `${ROOT}recordings/demo`;
const { db, close } = connect();
let truthTotal = 0;
let narratedTotal = 0;
let matchedTotal = 0;
try {
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".truth.json"))
    .sort()) {
    const id = file.replace(".truth.json", "");
    const metaPath = `${dir}/${id}.meta.json`;
    if (!existsSync(metaPath)) continue;
    const meta = JSON.parse(await readFile(metaPath, "utf8")) as {
      instruction: string;
      mode: string;
    };
    if (meta.mode !== "video") continue;
    const run = await db.query.runs.findFirst({
      // Scripted runs only: agent runs can share a task's text but have no ground truth.
      where: and(
        eq(schema.runs.task, meta.instruction),
        eq(schema.runs.mode, "video"),
        eq(schema.runs.status, "done"),
        like(schema.runs.agentModel, "scripted@%"),
      ),
      orderBy: desc(schema.runs.createdAt),
    });
    if (!run) {
      console.log(`${id}: no finished run`);
      continue;
    }
    const truth = (JSON.parse(await readFile(`${dir}/${file}`, "utf8")) as TruthStep[]).filter(
      (t) => t.action !== "claim",
    );
    const steps = (await loadSteps(db, run.id)).filter((s) => s.action !== "claim");
    const score = scoreNarration(truth, steps);
    truthTotal += score.truth;
    narratedTotal += score.narrated;
    matchedTotal += score.matched;
    console.log(
      `${id}  truth ${String(score.truth).padStart(2)}  narrated ${String(score.narrated).padStart(2)}  matched ${String(score.matched).padStart(2)}  recall ${score.recall.toFixed(2)}  precision ${score.precision.toFixed(2)}${score.missed.length ? `  missed: ${score.missed.map((m) => `${m.action} ${m.target}`).join("; ")}` : ""}`,
    );
  }
  console.log(
    `ALL  truth ${truthTotal}  narrated ${narratedTotal}  matched ${matchedTotal}  recall ${(matchedTotal / truthTotal).toFixed(2)}  precision ${(matchedTotal / narratedTotal).toFixed(2)}`,
  );
} finally {
  await close();
}
