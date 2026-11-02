/**
 * Run one scripted demo task and record it.
 * Usage (inside the sandbox): node /opt/blackbox/runner/run.ts <D01..D09> [label]
 * Writes /recordings/<label>.mp4, <label>.truth.json and <label>.meta.json.
 */
import { execFileSync, spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { Driver } from "./driver.ts";
import { NOVNC_URL, TASKS } from "./tasks.ts";

const SCRIPT_VERSION = "scripted@1.0.0";
const [id, labelArg] = process.argv.slice(2);
const task = id ? TASKS[id] : undefined;
if (!task) throw new Error(`usage: run.ts <${Object.keys(TASKS).join("|")}> [label]`);
const label = labelArg ?? `${task.id}-${new Date().toISOString().replace(/[:.]/g, "")}`;
const out = `/recordings/${label}`;

const post = (path: string, body: unknown) =>
  fetch(`http://crm.acme.test${path}`, { method: "POST", body: JSON.stringify(body) });

await post("/__test/reset", {});
if (task.faults) await post("/__test/faults", task.faults);
if (task.remote) {
  const remote = (path: string, body: unknown) =>
    fetch(`http://meridian${path}`, { method: "POST", body: JSON.stringify(body) });
  await remote("/__test/reset", {});
  if (task.remote.faults) await remote("/__test/faults", task.remote.faults);
}

const d = await Driver.connect();
await d.page.goto(task.remote ? NOVNC_URL : "http://crm.acme.test/contacts");
if (task.remote) await d.wait(3000); // let the viewer connect and draw the remote screen
await d.status(
  `Task: ${task.instruction.slice(0, 110)}${task.instruction.length > 110 ? "…" : ""}`,
);
await d.wait(1500);

const ffmpeg = spawn(
  "ffmpeg",
  [
    "-loglevel",
    "error",
    "-y",
    "-f",
    "x11grab",
    "-draw_mouse",
    "1",
    "-framerate",
    "10",
    "-video_size",
    `${process.env.SCREEN_W}x${process.env.SCREEN_H}`,
    "-i",
    process.env.DISPLAY ?? ":99",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    `${out}.mp4`,
  ],
  { stdio: ["ignore", "ignore", "inherit"] },
);
await d.wait(800);
d.startClock();
if (task.native) execFileSync("touch", ["/tmp/atspi-clock-start"]);

let failure: unknown = null;
try {
  await task.run(d);
} catch (error) {
  failure = error;
}
await d.wait(1000);
ffmpeg.kill("SIGINT");
await new Promise((r) => ffmpeg.once("exit", r));
await d.close();

writeFileSync(`${out}.truth.json`, JSON.stringify(d.truth, null, 2));
writeFileSync(
  `${out}.meta.json`,
  JSON.stringify(
    {
      id: task.id,
      taskId: task.taskId,
      instruction: task.instruction,
      surface: task.remote ? "noVNC · Meridian ERP (remote desktop)" : "Chromium · Acme CRM",
      mode: task.native ? "native" : "video",
      agent: { vendor: "blackbox", model: SCRIPT_VERSION },
      failure: failure ? String(failure) : null,
    },
    null,
    2,
  ),
);
if (failure) throw failure;
console.log(`${out}.mp4`);
