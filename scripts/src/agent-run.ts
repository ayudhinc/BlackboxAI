/**
 * Run our computer-use loop against the sandbox and record it.
 *   pnpm agent-run <label> --task "..." [--model muse-spark-1.3|muse-wonder-1.0]
 *     [--task-id id] [--faults '{"saveFails":"c-okafor"}'] [--max-steps 25]
 * Billed (one Spark or Wonder call per step, each with a lineage row).
 * Writes recordings/demo/<label>.mp4 and .meta.json for `pnpm seed-demo`.
 */
import { execFile, execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { parseArgs, promisify } from "node:util";
import { connect } from "@blackbox/db";
import {
  createMetaTransport,
  DbLineageSink,
  type Desktop,
  MetaClient,
  type ModelId,
  runAgent,
} from "@blackbox/engine";
import { loadEnv, ROOT } from "./env.ts";

const run = promisify(execFile);
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    task: { type: "string" },
    "task-id": { type: "string" },
    model: { type: "string", default: "muse-spark-1.3" },
    faults: { type: "string" },
    "max-steps": { type: "string", default: "25" },
  },
});
const label = positionals[0];
if (!label || !values.task) throw new Error('usage: agent-run <label> --task "..." [--model ...]');
const model = values.model as ModelId;
const container = `blackbox-agent-${label.toLowerCase()}`;
const IMAGE = "blackbox-sandbox:dev";

const dexec = (args: string[], opts: { encoding?: "buffer" } = {}) =>
  run("docker", ["exec", container, ...args], {
    maxBuffer: 1024 * 1024 * 64,
    ...(opts.encoding ? { encoding: "buffer" as const } : {}),
  });

class SandboxDesktop implements Desktop {
  readonly width = 1280;
  readonly height = 800;
  async screenshot(): Promise<Buffer> {
    const { stdout } = await run(
      "docker",
      [
        "exec",
        container,
        "ffmpeg",
        "-loglevel",
        "error",
        "-f",
        "x11grab",
        "-video_size",
        "1280x800",
        "-i",
        ":99",
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "-",
      ],
      { encoding: "buffer", maxBuffer: 1024 * 1024 * 32 },
    );
    return stdout;
  }
  async click(x: number, y: number, double: boolean): Promise<void> {
    // Glide so the cursor's path is visible in the recording, as a person's would be.
    await dexec([
      "bash",
      "-c",
      `eval "$(xdotool getmouselocation --shell)"; for i in $(seq 1 12); do xdotool mousemove $((X + (${x} - X) * i / 12)) $((Y + (${y} - Y) * i / 12)); sleep 0.03; done; sleep 0.2; xdotool click ${double ? "--repeat 2 " : ""}1`,
    ]);
    await sleep(1200);
  }
  async type(text: string): Promise<void> {
    await dexec(["xdotool", "type", "--delay", "70", text]);
    await sleep(600);
  }
  async key(keys: string): Promise<void> {
    await dexec(["xdotool", "key", ...keys.split(/\s+/)]);
    await sleep(1200);
  }
  async scroll(dy: number): Promise<void> {
    await dexec([
      "bash",
      "-c",
      `for i in $(seq 1 ${Math.abs(dy)}); do xdotool click ${dy > 0 ? 5 : 4}; sleep 0.05; done`,
    ]);
    await sleep(800);
  }
  async status(step: string, claim = ""): Promise<void> {
    await dexec([
      "curl",
      "-s",
      "-X",
      "POST",
      "http://crm.acme.test/__console/state",
      "-d",
      JSON.stringify({ step, claim }),
    ]);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

loadEnv();
const { db, close } = connect();
const lineage = new DbLineageSink(db);
const client = new MetaClient(createMetaTransport(), lineage);
execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" });
execFileSync("docker", [
  "run",
  "-d",
  "--name",
  container,
  "--shm-size=1g",
  "--add-host",
  "crm.acme.test:127.0.0.1",
  "--add-host",
  "webmail.test:127.0.0.1",
  "-v",
  `${ROOT}recordings/demo:/recordings`,
  IMAGE,
  "demo-env",
]);
try {
  for (let i = 0; i < 100; i++) {
    if (execFileSync("docker", ["logs", container], { encoding: "utf8" }).includes("READY")) break;
    await sleep(200);
  }
  await dexec(["curl", "-s", "-X", "POST", "http://crm.acme.test/__test/reset"]);
  if (values.faults)
    await dexec([
      "curl",
      "-s",
      "-X",
      "POST",
      "http://crm.acme.test/__test/faults",
      "-d",
      values.faults,
    ]);
  const desktop = new SandboxDesktop();
  await desktop.status(`Task: ${values.task.slice(0, 110)}${values.task.length > 110 ? "…" : ""}`);
  const pid = String((await dexec(["record", `/recordings/${label}.mp4`, "10"])).stdout).trim();
  await sleep(1000);
  const started = Date.now();
  const result = await runAgent(client, desktop, values.task, {
    model,
    maxSteps: Number(values["max-steps"]),
    log: (m) => console.log(`  ${m}`),
  });
  await sleep(2500);
  await dexec(["stop-recording", pid]);
  await writeFile(
    `${ROOT}recordings/demo/${label}.meta.json`,
    JSON.stringify(
      {
        id: label,
        taskId: values["task-id"] ?? label.toLowerCase(),
        instruction: values.task,
        surface: "Chromium · Acme CRM",
        mode: "video",
        agent: { vendor: "meta", model },
        failure: null,
        agentRun: {
          steps: result.actions.length,
          stoppedBy: result.stoppedBy,
          claim: result.claim,
          seconds: Math.round((Date.now() - started) / 1000),
        },
      },
      null,
      2,
    ),
  );
  console.log(
    `${label}: ${result.actions.length} steps, ${result.stoppedBy}, claim: ${result.claim}`,
  );
} finally {
  execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" });
  await close();
}
