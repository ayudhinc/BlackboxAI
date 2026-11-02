/**
 * Drives the sandbox like a user: the real X cursor glides to each element and
 * clicks, keys go through xdotool, and URLs are typed into the address bar.
 * Chromium's debugging protocol is used only to find where elements are, never
 * to act. Every action is logged as ground truth for the narration eval set.
 */
import { execFileSync } from "node:child_process";
import { type Browser, chromium, type Page } from "playwright-core";

export type TruthStep = {
  tMs: number;
  action: "click" | "type" | "navigate" | "key" | "scroll" | "claim";
  target: string;
  field: string | null;
};

const xdo = (...args: string[]) => execFileSync("xdotool", args, { encoding: "utf8" }).trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Driver {
  readonly truth: TruthStep[] = [];
  private startedAt = 0;

  private readonly browser: Browser;
  readonly page: Page;

  // Plain fields, not parameter properties: Node runs this file by stripping types.
  private constructor(browser: Browser, page: Page) {
    this.browser = browser;
    this.page = page;
  }

  static async connect(): Promise<Driver> {
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    const page = browser.contexts()[0]?.pages()[0];
    if (!page) throw new Error("No Chromium page to drive");
    return new Driver(browser, page);
  }

  /** Call when recording starts; ground-truth times are relative to it. */
  startClock(): void {
    this.startedAt = Date.now();
  }

  private log(action: TruthStep["action"], target: string, field: string | null = null): void {
    this.truth.push({ tMs: Date.now() - this.startedAt, action, target, field });
  }

  async status(step: string, claim = ""): Promise<void> {
    await fetch("http://crm.acme.test/__console/state", {
      method: "POST",
      body: JSON.stringify({ step, claim }),
    });
  }

  async claim(text: string): Promise<void> {
    await this.status("Finished", text);
    this.log("claim", text);
    await sleep(2500);
  }

  private async screenPoint(selector: string): Promise<{ x: number; y: number; label: string }> {
    const loc = this.page.locator(selector).first();
    await loc.scrollIntoViewIfNeeded();
    const box = await loc.boundingBox();
    if (!box) throw new Error(`No box for ${selector}`);
    const origin = await this.page.evaluate(() => ({
      x: window.screenX + (window.outerWidth - window.innerWidth) / 2,
      y: window.screenY + window.outerHeight - window.innerHeight,
    }));
    const label = await loc.evaluate((el) => {
      const e = el as HTMLElement & { labels?: NodeListOf<HTMLLabelElement> };
      return (
        e.getAttribute("aria-label") ||
        e.labels?.[0]?.textContent ||
        e.textContent ||
        ""
      ).trim();
    });
    return {
      x: Math.round(origin.x + box.x + box.width / 2),
      y: Math.round(origin.y + box.y + box.height / 2),
      label,
    };
  }

  private async glide(x: number, y: number): Promise<void> {
    const [cx, cy] = xdo("getmouselocation", "--shell")
      .split("\n")
      .slice(0, 2)
      .map((l) => Number(l.split("=")[1]));
    const steps = 14;
    for (let i = 1; i <= steps; i++) {
      xdo(
        "mousemove",
        String(Math.round((cx ?? 0) + ((x - (cx ?? 0)) * i) / steps)),
        String(Math.round((cy ?? 0) + ((y - (cy ?? 0)) * i) / steps)),
      );
      await sleep(30);
    }
    await sleep(250);
  }

  async click(selector: string, role = "button", pause = 1200): Promise<void> {
    const p = await this.screenPoint(selector);
    await this.glide(p.x, p.y);
    xdo("click", "1");
    this.log("click", `${role} '${p.label}'`);
    await sleep(pause);
  }

  /** Click a field and type into it. Sensitive values are typed but never logged. */
  async type(selector: string, text: string, opts: { clear?: boolean } = {}): Promise<void> {
    const p = await this.screenPoint(selector);
    await this.glide(p.x, p.y);
    xdo("click", "1");
    await sleep(300);
    if (opts.clear) {
      xdo("key", "ctrl+a");
      xdo("key", "BackSpace");
    }
    xdo("type", "--delay", "70", text);
    this.log("type", `field '${p.label}'`, p.label);
    await sleep(800);
  }

  /** Pick an option in a native <select> by clicking it and typing the option's text. */
  async choose(selector: string, option: string): Promise<void> {
    const p = await this.screenPoint(selector);
    await this.glide(p.x, p.y);
    xdo("click", "1");
    await sleep(500);
    xdo("type", "--delay", "60", option);
    xdo("key", "Return");
    this.log("click", `combobox '${p.label.split("\n")[0]}' option '${option}'`);
    await sleep(900);
  }

  /** Click the middle of the remote-desktop viewer so keys go to the remote session. */
  async focusViewer(): Promise<void> {
    const box = await this.page.evaluate(() => ({
      x: window.screenX + window.outerWidth / 2,
      y: window.screenY + window.outerHeight - window.innerHeight + window.innerHeight / 2,
    }));
    await this.glide(Math.round(box.x), Math.round(box.y));
    xdo("click", "1");
    this.log("click", "remote desktop viewer");
    await sleep(800);
  }

  /** Keys into whatever has focus, logged under the given label (remote sessions have no selectors). */
  async keys(keys: string, target: string): Promise<void> {
    xdo("key", keys);
    this.log("key", target);
    await sleep(700);
  }

  async typeKeys(text: string, field: string): Promise<void> {
    xdo("type", "--delay", "90", text);
    this.log("type", `field '${field}'`, field);
    await sleep(600);
  }

  async key(keys: string, target = keys): Promise<void> {
    xdo("key", keys);
    this.log("key", target);
    await sleep(900);
  }

  async goto(url: string): Promise<void> {
    xdo("key", "ctrl+l");
    await sleep(250);
    xdo("type", "--delay", "35", url);
    xdo("key", "Return");
    this.log("navigate", url);
    await this.page.waitForLoadState("load");
    await sleep(1200);
  }

  async scroll(ticks: number): Promise<void> {
    for (let i = 0; i < Math.abs(ticks); i++) {
      xdo("click", ticks > 0 ? "5" : "4");
      await sleep(60);
    }
    this.log("scroll", ticks > 0 ? "down" : "up");
    await sleep(700);
  }

  async wait(ms: number): Promise<void> {
    await sleep(ms);
  }

  async close(): Promise<void> {
    await this.browser.close().catch(() => {});
  }
}
