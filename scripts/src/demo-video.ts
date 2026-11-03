/**
 * Record the demo video against the local stack: a paced walkthrough with a
 * visible cursor and plain-word captions drawn in the page, so the recording
 * needs no subtitle filter. The policy compile and one agent upload run live;
 * their waits are cut out afterwards. Writes an MP4 and a matching SRT.
 *   pnpm dev:web & pnpm dev:worker   (local Postgres up, demo runs seeded)
 *   pnpm demo-video
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { connect } from "@blackbox/db";
import { sql } from "drizzle-orm";
import { chromium, type Locator, type Page } from "playwright-core";
import { loadEnv, ROOT } from "./env.ts";

loadEnv();
const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3500";
const OUT = `${ROOT}recordings/video/`;
const SIZE = { width: 1280, height: 800 };
const HOSTED = "blackboxai-ayudh-incs-projects.vercel.app";

type Cue = { start: number; end: number; text: string };
const cues: Cue[] = [];
const cuts: Array<[number, number]> = [];
let t0 = 0;
const now = () => Date.now() - t0;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- the demo runs this walkthrough opens, found by what they are ----------

const { db, close } = connect();
async function runId(where: ReturnType<typeof sql>): Promise<string> {
  const rows = await db.execute<{ id: string }>(
    sql`select r.id from runs r join verdicts v on v.run_id = r.id
        where r.status = 'done' and ${where} order by r.created_at limit 1`,
  );
  const id = rows.rows[0]?.id;
  if (!id) throw new Error("A demo run is missing from the local database: run pnpm seed-demo.");
  return id;
}
async function cost(id: string): Promise<number> {
  const rows = await db.execute<{ c: number }>(
    sql`select coalesce(sum(cost_usd), 0)::float as c from lineage where run_id = ${id}`,
  );
  return rows.rows[0]?.c ?? 0;
}
const scripted = sql`r.agent_model like 'scripted@%'`;
const D01 = await runId(
  sql`r.task_id = 'crm-contact-dedupe' and r.mode = 'video' and ${scripted} and v.status = 'completed'`,
);
const D02 = await runId(
  sql`r.task_id = 'crm-contact-dedupe' and ${scripted} and v.status = 'completed_with_violations'`,
);
const D03 = await runId(sql`r.task_id = 'crm-contact-dedupe' and r.mode = 'native'`);
const D10 = await runId(sql`r.task_id = 'erp-invoice-post' and v.status = 'needs_review'`);
const [videoCost, nativeCost] = [await cost(D01), await cost(D03)];
await close();

const a01 = JSON.parse(readFileSync(`${ROOT}recordings/demo/A01.meta.json`, "utf8")) as {
  instruction: string;
  taskId: string;
  surface: string;
};
const operator = JSON.parse(readFileSync(`${ROOT}scripts/fixtures/dev-operator.json`, "utf8")) as {
  email: string;
  password: string;
};

// ---- overlay: caption bar and cursor, re-created after every navigation ----

let cursor = { x: SIZE.width / 2, y: SIZE.height / 2 };
let caption = "";

async function overlay(page: Page): Promise<void> {
  await page.evaluate(
    ({ x, y, text }) => {
      if (!document.getElementById("demo-css")) {
        const css = document.createElement("style");
        css.id = "demo-css";
        css.textContent = `
          nextjs-portal { display: none !important; }
          #demo-cap { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%);
            max-width: 980px; padding: 14px 22px; border-radius: 10px; z-index: 2147483646;
            background: rgba(17, 20, 28, 0.9); color: #fff; text-align: center;
            font: 500 22px/1.4 -apple-system, "Helvetica Neue", Arial, sans-serif;
            transition: opacity 250ms; pointer-events: none; }
          #demo-cap:empty { opacity: 0; }
          #demo-cur { position: fixed; width: 22px; height: 22px; margin: -11px 0 0 -11px;
            border-radius: 50%; border: 2px solid #fff; background: rgba(29, 78, 216, 0.55);
            box-shadow: 0 1px 6px rgba(0,0,0,0.45); z-index: 2147483647; pointer-events: none;
            transition: left 700ms ease-in-out, top 700ms ease-in-out, transform 150ms; }
          #demo-cur.down { transform: scale(0.7); }`;
        document.head.append(css);
      }
      for (const id of ["demo-cap", "demo-cur"]) {
        if (!document.getElementById(id)) {
          const el = document.createElement("div");
          el.id = id;
          document.body.append(el);
        }
      }
      const cur = document.getElementById("demo-cur") as HTMLElement;
      cur.style.left = `${x}px`;
      cur.style.top = `${y}px`;
      (document.getElementById("demo-cap") as HTMLElement).textContent = text;
    },
    { ...cursor, text: caption },
  );
}

/**
 * React hydration can drop nodes added to <body>, so the overlay is re-applied
 * on a timer rather than once per navigation.
 */
function keepOverlay(page: Page): () => void {
  const timer = setInterval(() => {
    overlay(page).catch(() => {});
  }, 250);
  return () => clearInterval(timer);
}

/** Show a caption long enough to read at an unhurried pace. */
async function say(page: Page, text: string, extraMs = 0): Promise<void> {
  if (cues.length && cues[cues.length - 1]?.end === Number.POSITIVE_INFINITY)
    (cues[cues.length - 1] as Cue).end = now();
  caption = text;
  await overlay(page);
  const start = now();
  await pause(Math.min(9500, Math.max(3200, text.length * 62)) + extraMs);
  cues.push({ start, end: Number.POSITIVE_INFINITY, text });
}

async function go(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await overlay(page);
  await pause(900);
}

async function moveTo(page: Page, loc: Locator): Promise<void> {
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.boundingBox();
  if (!box) throw new Error("Demo target is not on screen.");
  cursor = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await overlay(page);
  await pause(950);
}

async function click(page: Page, loc: Locator): Promise<void> {
  await moveTo(page, loc);
  await page.evaluate(() => document.getElementById("demo-cur")?.classList.add("down"));
  await pause(160);
  await page.evaluate(() => document.getElementById("demo-cur")?.classList.remove("down"));
  await loc.click();
  await pause(700);
}

async function type(page: Page, loc: Locator, text: string): Promise<void> {
  await click(page, loc);
  await loc.pressSequentially(text, { delay: 28 });
  await pause(500);
}

async function scrollTo(loc: Locator): Promise<void> {
  await loc.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  await pause(1600);
}

/** Wait for something slow; the wait itself is cut from the video. */
async function waitCut(page: Page, text: string, until: () => Promise<unknown>): Promise<void> {
  await say(page, text);
  const start = now();
  await until();
  await overlay(page);
  const end = now();
  if (end - start > 2500) cuts.push([start + 1000, end - 800]);
}

let cardHtml = "";
async function card(page: Page, title: string, sub: string): Promise<void> {
  cardHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;height:100vh;
    display:grid;place-items:center;background:#f4f5f7;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif">
    <div style="text-align:center"><div style="display:flex;gap:14px;align-items:center;justify-content:center">
    <span style="width:34px;height:34px;border-radius:50%;border:3px solid #11141c;display:grid;place-items:center">
    <span style="width:14px;height:14px;border-radius:50%;background:#ea580c"></span></span>
    <span style="font-size:48px;font-weight:700;color:#11141c">${title}</span></div>
    <p style="font-size:24px;color:#4b5563;margin-top:18px">${sub}</p></div></body></html>`;
  await page.goto(`${BASE}/__demo-card?${Date.now()}`, { waitUntil: "load" });
  await overlay(page);
  await pause(1200);
}

// ---- the walkthrough --------------------------------------------------------

const browser = await chromium.launch({ channel: "chrome" });
const login = await browser.newContext({ viewport: SIZE });
const lp = await login.newPage();
await lp.goto(`${BASE}/login`);
await lp.fill("#email", operator.email);
await lp.fill("#password", operator.password);
await lp.click("button[type=submit]");
await lp.waitForURL(/\/runs/);
const storageState = await login.storageState();
await login.close();

mkdirSync(OUT, { recursive: true });
const ctx = await browser.newContext({
  viewport: SIZE,
  storageState,
  recordVideo: { dir: OUT, size: SIZE },
});
const page = await ctx.newPage();
await page.route(`${BASE}/__demo-card*`, (r) =>
  r.fulfill({ contentType: "text/html; charset=utf-8", body: cardHtml }),
);
t0 = Date.now();
const stopOverlay = keepOverlay(page);
const section = (name: string) => page.locator(`section[aria-label="${name}"]`);

try {
  await card(
    page,
    "BlackboxAI",
    "A flight recorder for AI agents that use software through the screen.",
  );
  await say(page, "AI agents now click through real software for us.");
  await say(
    page,
    "When one says “done”, how do you know it really was, and that it followed the rules?",
  );

  // 1. Policy: compile and sign off, live.
  await go(page, "/policies/new");
  await say(
    page,
    "Start with the rules: a one-page operating policy for a CRM, written for people.",
  );
  await moveTo(page, page.locator("input[type=file]"));
  await page.setInputFiles("input[type=file]", `${ROOT}demo/policies/crm-policy.md`);
  await click(page, page.getByRole("button", { name: "Upload and compile" }));
  await waitCut(
    page,
    "Meta’s Muse Spark reads the policy and turns each rule into a check a machine can run.",
    () => page.getByRole("button", { name: "Sign off all rules" }).waitFor({ timeout: 180_000 }),
  );
  const policyId = page.url().split("/").pop() as string;
  await say(page, "Each rule comes back in plain English, with the exact line it came from.");
  await scrollTo(page.getByText("R4", { exact: true }).first());
  await say(page, "Nothing gets checked until a person reads the rules and signs them off.");
  await page.evaluate(() => document.documentElement.scrollTo({ top: 0, behavior: "smooth" }));
  await pause(1200);
  await click(page, page.getByRole("button", { name: "Sign off all rules" }));
  await say(page, "Signed off. These are now the rules every run is checked against.");

  // 2. A real agent's recording, uploaded and verified live.
  await go(page, "/runs/new");
  await say(
    page,
    "Now a screen recording of an AI agent doing a real task. Any agent, any vendor, no SDK.",
  );
  await moveTo(page, page.locator("input[type=file]"));
  await page.setInputFiles("input[type=file]", `${ROOT}recordings/demo/A01.mp4`);
  await say(page, "This agent was Meta’s Muse Spark, asked to merge a duplicate contact.");
  await type(page, page.locator("textarea"), a01.instruction);
  await type(page, page.getByPlaceholder(/vendor\/model/), "meta/muse-spark-1.3");
  await type(page, page.getByPlaceholder("Chromium · Acme CRM"), a01.surface);
  await type(page, page.getByPlaceholder("crm-contact-dedupe"), a01.taskId);
  await moveTo(page, page.locator("select"));
  await page.selectOption("select", policyId);
  await pause(600);
  await click(page, page.getByRole("button", { name: "Upload and verify" }));
  await page.waitForURL(/\/runs\/run_/);
  await overlay(page);
  await waitCut(
    page,
    "BlackboxAI splits the video into frames. Meta’s SAM 3.1 tracks the cursor and buttons, and Muse Spark writes down each step.",
    () => section("Verdict").getByText("Decided by").waitFor({ timeout: 600_000 }),
  );
  const verdict = ((await section("Verdict").textContent()) ?? "").toLowerCase();
  const findings =
    ((await section("Findings").locator("h2").textContent()) ?? "").match(/\d+/)?.[0] ?? "0";
  await scrollTo(section("Steps"));
  await say(
    page,
    "Every step: what the agent did, what changed on screen, and how sure the model is.",
  );
  await click(page, section("Steps").locator("button.step").nth(3));
  await say(page, "Click a step to see the frame it came from.");
  await page.evaluate(() => document.documentElement.scrollTo({ top: 0, behavior: "smooth" }));
  await pause(1200);
  await say(
    page,
    verdict.includes("completed with violations")
      ? `Verdict: done, but ${findings} rule${findings === "1" ? "" : "s"} broken.`
      : verdict.includes("completed")
        ? "Verdict: the task was really done, and no rule was broken."
        : "The verdict, with the frames that support it.",
  );
  await say(page, "The verdict cites the frames that prove it, so you can check it yourself.");

  // 3. The same task, done badly.
  await go(page, `/runs/${D02}`);
  await say(page, "The same task, another run. The job got done, but two rules were broken.");
  await scrollTo(section("Findings"));
  await say(page, "It deleted a record with no confirmation box.");
  await say(
    page,
    "And it typed the card number into a card field that the policy keeps for people.",
  );
  await scrollTo(section("Regression"));
  await say(
    page,
    "Compared with the clean run before it: two new problems, and a different path through the app.",
  );

  // 4. No DOM at all: a remote desktop.
  await go(page, `/runs/${D10}`);
  await say(
    page,
    "This one is an old finance app on a remote desktop. No web page underneath, only pixels.",
  );
  await scrollTo(section("Findings"));
  await say(
    page,
    "The agent pressed Post again and again after it was rejected, then said the invoice was posted.",
  );
  await say(page, "The screen says otherwise. BlackboxAI caught both from the video alone.");
  await go(page, "/queue");
  await say(
    page,
    "When a person needs to look, the run goes to the review queue instead of being passed.",
  );

  // 5. Native mode.
  await go(page, `/runs/${D03}`);
  await say(
    page,
    "In our own sandbox we also record what the app itself reports: every click, field and dialog.",
  );
  await scrollTo(section("Steps"));
  await say(page, "Then each step is a fact, not a model’s guess.");
  await scrollTo(section("Lineage"));
  await say(
    page,
    `And it costs about $${nativeCost.toFixed(2)} to verify, against $${videoCost.toFixed(2)} from video.`,
  );
  await say(
    page,
    "Every model call is logged: which model, how many tokens, what it cost and how long it took.",
  );

  // 6. Evidence.
  await go(page, `/api/runs/${D02}/evidence?format=html`);
  await say(page, "Everything exports as a sealed evidence pack an auditor can read.");
  await page.mouse.wheel(0, 500);
  await pause(1500);

  await card(page, "BlackboxAI", `Built on Meta’s Muse Spark 1.3 and SAM 3.1 · ${HOSTED}`);
  await say(page, "Know what your agents really did.", 1500);
  (cues[cues.length - 1] as Cue).end = now();
} finally {
  stopOverlay();
  await ctx.close();
  await browser.close();
}

// ---- cut the waits, encode, and write the subtitles -------------------------

const raw = await page.video()?.path();
if (!raw) throw new Error("Playwright did not produce a video.");
const keep: Array<[number, number]> = [];
let from = 0;
for (const [a, b] of cuts) {
  keep.push([from, a]);
  from = b;
}
keep.push([from, now()]);

const filter = `${keep
  .map(([a, b], i) => `[0:v]trim=start=${a / 1000}:end=${b / 1000},setpts=PTS-STARTPTS[v${i}]`)
  .join(";")};${keep.map((_, i) => `[v${i}]`).join("")}concat=n=${keep.length}:v=1:a=0,fps=30[out]`;
const mp4 = `${OUT}blackboxai-demo.mp4`;
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-i",
  raw,
  "-filter_complex",
  filter,
  "-map",
  "[out]",
  "-c:v",
  "libx264",
  "-crf",
  "18",
  "-preset",
  "slow",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  mp4,
]);

/** Map a time on the raw recording to the cut video. */
function shift(t: number): number {
  let removed = 0;
  for (const [a, b] of cuts) {
    if (t >= b) removed += b - a;
    else if (t > a) return a - removed;
  }
  return t - removed;
}
const stamp = (ms: number) => {
  const d = new Date(Math.max(0, ms));
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")},${String(d.getUTCMilliseconds()).padStart(3, "0")}`;
};
const srt = cues
  .map((c, i) => `${i + 1}\n${stamp(shift(c.start))} --> ${stamp(shift(c.end))}\n${c.text}\n`)
  .join("\n");
writeFileSync(`${OUT}blackboxai-demo.srt`, srt);
console.log(
  `Wrote ${mp4} (${(shift(now()) / 1000).toFixed(0)} s) and blackboxai-demo.srt; cut ${cuts.length} waits.`,
);
