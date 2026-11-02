import { describe, expect, it } from "vitest";
import { mapRuntimeEvents, parseRuntimeJsonl } from "./map-events.ts";

const jsonl = [
  { tMs: 0, pid: 10, window: "Contact — Acme CRM", event: "window.focus" },
  {
    tMs: 2000,
    pid: 10,
    window: "Contact — Acme CRM",
    event: "text.insert",
    role: "entry",
    name: "Tax ID (SSN)",
    value: "[redacted]",
  },
  {
    tMs: 4000,
    pid: 10,
    window: "Contact — Acme CRM",
    event: "button.press",
    role: "push button",
    name: "Delete contact",
  },
  {
    tMs: 4300,
    pid: 10,
    window: "Contact — Acme CRM",
    event: "dialog.open",
    role: "alert",
    name: "Delete contact?",
  },
  { tMs: 6000, pid: 10, window: "Contact — Acme CRM", event: "agent.claim", text: "Done." },
]
  .map((e) => JSON.stringify(e))
  .join("\n");

describe("native event mapping", () => {
  const signatures = Array.from({ length: 20 }, (_, i) => `sig${i}`);

  it("maps events to ground-truth steps", () => {
    const events = parseRuntimeJsonl("run_1", jsonl);
    const { steps, agentClaim } = mapRuntimeEvents("run_1", events, signatures, 500);
    expect(steps.map((s) => [s.action, s.target, s.field])).toEqual([
      ["navigate", "window Contact — Acme CRM", null],
      ["type", "field 'Tax ID (SSN)'", "Tax ID (SSN)"],
      ["click", "push button 'Delete contact'", null],
      ["claim", "Done.", null],
    ]);
    expect(steps.every((s) => s.confidence === 1 && s.source === "native")).toBe(true);
    expect(steps[1]?.redacted).toBe(true);
    expect(steps[2]?.dialogOpened).toBe(true);
    expect(steps[2]?.app).toBe("Contact — Acme CRM");
    expect(agentClaim).toBe("Done.");
  });

  it("rejects a malformed line with its line number", () => {
    expect(() => parseRuntimeJsonl("run_1", '{"tMs":0}\n')).toThrow(/line 1/);
  });

  it("rejects a raw value: only [redacted] may be stored", () => {
    const bad = JSON.stringify({
      tMs: 0,
      pid: 1,
      window: "w",
      event: "text.insert",
      value: "4242",
    });
    expect(() => parseRuntimeJsonl("run_1", bad)).toThrow(/line 1/);
  });
});
