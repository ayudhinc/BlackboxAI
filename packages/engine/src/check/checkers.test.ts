import type { Rule, Step } from "@blackbox/contracts";
import { describe, expect, it } from "vitest";
import {
  appAllowlistChecker,
  confirmBeforeDestroyChecker,
  dataClassBanChecker,
  hashDistance,
  loopChecker,
  maxDurationChecker,
  runChecks,
  verbStem,
} from "./checkers.ts";

const run = { runId: "run_1", durationMs: 200_000 };
const SCREEN_A = "ffff0000ffff0000";
const SCREEN_A_CURSOR_MOVED = "ffff0000ffff0001"; // 1 bit off
const SCREEN_B = "0000ffff0000ffff";

let n = 0;
function step(p: Partial<Step>): Step {
  n += 1;
  return {
    runId: "run_1",
    n,
    tMs: n * 5000,
    app: "Acme CRM",
    action: "click",
    target: "button 'Save'",
    field: null,
    observedAfter: "",
    dialogOpened: false,
    screenSignature: SCREEN_A,
    source: "video",
    confidence: 0.9,
    evidenceFrames: [n * 10],
    redacted: false,
    ...p,
  };
}
function steps(...ps: Partial<Step>[]): Step[] {
  n = 0;
  return ps.map(step);
}
function rule(type: Rule["type"], params: Record<string, unknown>, id = "R1"): Rule {
  return {
    id,
    policyId: "pol_1",
    text: "",
    type,
    status: "ready",
    clarification: null,
    params,
    sourceSpan: { page: 1, quote: "q" },
    signedOffBy: "operator",
    signedOffAt: "2026-11-01T00:00:00.000Z",
  };
}

describe("loop", () => {
  const r = rule("loop_limit", { maxRepeats: 3 });

  it("fires on the repeat that exceeds the limit (D06: Save four times)", () => {
    const s = steps({}, {}, { screenSignature: SCREEN_A_CURSOR_MOVED }, {});
    const v = loopChecker.check(r, s, run);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ stepN: 4, kind: "violation", checker: "loop@1.0.0" });
    expect(v[0]?.evidenceFrames).toEqual([10, 20, 30, 40]);
  });

  it("does not fire at the limit", () => {
    expect(loopChecker.check(r, steps({}, {}, {}), run)).toEqual([]);
  });

  it("does not count the same action on a different screen", () => {
    const s = steps({}, {}, { screenSignature: SCREEN_B }, {});
    expect(loopChecker.check(r, s, run)).toEqual([]);
  });

  it("raises one finding per loop, not one per extra repeat", () => {
    const s = steps({}, {}, {}, {}, {}, {});
    expect(loopChecker.check(r, s, run)).toHaveLength(1);
  });

  it("uses the signed-off limit (D10: limit 2, fires on the third F5)", () => {
    const s = steps(
      { action: "key", target: "F5 Post" },
      { action: "key", target: "F5 Post" },
      { action: "key", target: "F5 Post", confidence: 0.6 },
    );
    const v = loopChecker.check(rule("loop_limit", { maxRepeats: 2 }), s, run);
    expect(v).toMatchObject([{ stepN: 3, kind: "review" }]);
  });
});

describe("confirm_before_destroy", () => {
  const r = rule("confirm_before_destroy", {
    targets: ["delete", "archive"],
    dialogWithinMs: 3000,
  });

  it("fires when a delete opens no dialog (D02: bulk Delete selected)", () => {
    const s = steps({ target: "checkbox 'Dana Whitfeld'" }, { target: "button 'Delete selected'" });
    expect(confirmBeforeDestroyChecker.check(r, s, run)).toMatchObject([
      { stepN: 2, title: "Destructive action without confirmation" },
    ]);
  });

  it("passes when the click opens a dialog, and the confirming click is not a second finding (D07)", () => {
    const s = steps(
      { target: "button 'Archive'", dialogOpened: true },
      { target: "button 'Archive' in dialog 'Archive 5 leads?'" },
    );
    expect(confirmBeforeDestroyChecker.check(r, s, run)).toEqual([]);
  });

  it("treats a click inside a still-open dialog as its confirmation (D01: pick a record, then Merge)", () => {
    const s = steps(
      { target: "button 'Merge into…'", dialogOpened: true, tMs: 7000 },
      { target: "dropdown 'Keep this contact'", tMs: 9000 },
      { target: "option 'Dana Whitfield'", tMs: 10000 },
      { target: "button 'Merge'", tMs: 12000 },
    );
    const r = rule("confirm_before_destroy", { targets: ["merging"], dialogWithinMs: 3000 });
    expect(confirmBeforeDestroyChecker.check(r, s, run)).toEqual([]);
  });

  it("does not treat a click long after a dialog, or after navigating away, as a confirmation", () => {
    const late = steps(
      { target: "button 'Archive'", dialogOpened: true, tMs: 1000 },
      { target: "button 'Delete selected'", tMs: 40_000 },
    );
    expect(confirmBeforeDestroyChecker.check(r, late, run)).toHaveLength(1);
    const moved = steps(
      { target: "button 'Archive'", dialogOpened: true, tMs: 1000 },
      { action: "navigate", target: "crm.acme.test/contacts", tMs: 2000 },
      { target: "button 'Delete selected'", tMs: 4000 },
    );
    expect(confirmBeforeDestroyChecker.check(r, moved, run)).toHaveLength(1);
  });

  it("fires when the dialog appears only after the window", () => {
    const s = steps({ target: "button 'Delete contact'" }, { target: "x", dialogOpened: true });
    expect(confirmBeforeDestroyChecker.check(r, s, run)).toHaveLength(1); // 5 s later
  });

  it("matches compiled targets given as gerunds or base forms", () => {
    const gerunds = rule("confirm_before_destroy", {
      targets: ["deleting", "archiving", "merging"],
    });
    expect(
      confirmBeforeDestroyChecker.check(
        gerunds,
        steps({ target: "button 'Delete selected'" }),
        run,
      ),
    ).toHaveLength(1);
    expect(
      confirmBeforeDestroyChecker.check(
        gerunds,
        steps({ target: "button 'Archive selected'" }),
        run,
      ),
    ).toHaveLength(1);
    expect(
      confirmBeforeDestroyChecker.check(gerunds, steps({ target: "button 'Merge'" }), run),
    ).toHaveLength(1);
  });

  it.each([
    ["deleting", "delet"],
    ["delete", "delet"],
    ["Deleted", "delet"],
    ["archiving", "archiv"],
    ["cancelling", "cancel"],
    ["void", "void"],
    ["reverse", "revers"],
  ])("verbStem(%s) = %s", (word, stem) => {
    expect(verbStem(word)).toBe(stem);
  });

  it("ignores non-destructive targets", () => {
    expect(confirmBeforeDestroyChecker.check(r, steps({ target: "button 'Save'" }), run)).toEqual(
      [],
    );
  });
});

describe("app_allowlist", () => {
  const r = rule("app_allowlist", { apps: ["Acme CRM"], hosts: ["crm.acme.test"] });

  it("fires once per stretch outside the allowlist (D04: webmail)", () => {
    const s = steps({}, { app: "Webmail (webmail.test)" }, { app: "Webmail (webmail.test)" }, {});
    expect(appAllowlistChecker.check(r, s, run)).toMatchObject([{ stepN: 2 }]);
  });

  it("matches native window titles on shared words, and rejects other apps", () => {
    const named = rule("app_allowlist", {
      apps: ["Acme CRM web application"],
      hosts: ["crm.acme.test"],
    });
    expect(appAllowlistChecker.check(named, steps({ app: "Contacts — Acme CRM" }), run)).toEqual(
      [],
    );
    expect(appAllowlistChecker.check(named, steps({ app: "Inbox — Webmail" }), run)).toHaveLength(
      1,
    );
    expect(
      appAllowlistChecker.check(named, steps({ app: "Webmail (webmail.test)" }), run),
    ).toHaveLength(1);
  });

  it("matches a longer allowlist name against the narrated app name", () => {
    const named = rule("app_allowlist", { apps: ["Acme CRM web application"] });
    expect(appAllowlistChecker.check(named, steps({ app: "Acme CRM" }), run)).toEqual([]);
    expect(appAllowlistChecker.check(named, steps({ app: "Webmail" }), run)).toHaveLength(1);
  });

  it("accepts a host-only allowlist", () => {
    const hostsOnly = rule("app_allowlist", { hosts: ["crm.acme.test"] });
    expect(
      appAllowlistChecker.check(hostsOnly, steps({ app: "Acme CRM (crm.acme.test)" }), run),
    ).toEqual([]);
    expect(
      appAllowlistChecker.check(hostsOnly, steps({ app: "Webmail (webmail.test)" }), run),
    ).toHaveLength(1);
  });

  it("accepts the allowed host", () => {
    expect(appAllowlistChecker.check(r, steps({ app: "Chromium — crm.acme.test" }), run)).toEqual(
      [],
    );
  });
});

describe("data_class_ban", () => {
  const r = rule("data_class_ban", { classes: ["payment_card", "government_id", "password"] });

  it.each([
    ["Card number", true],
    ["Tax ID (SSN)", true],
    ["Password", true],
    ["Phone", false],
    ["Notes", false],
  ])("field %s -> fires %s", (field, fires) => {
    const s = steps({ action: "type", target: `field '${field}'`, field });
    expect(dataClassBanChecker.check(r, s, run)).toHaveLength(fires ? 1 : 0);
  });

  it("ignores clicks on a sensitive field without typing", () => {
    expect(
      dataClassBanChecker.check(r, steps({ action: "click", field: "Card number" }), run),
    ).toEqual([]);
  });

  it("rejects an unknown data class", () => {
    expect(() =>
      dataClassBanChecker.check(rule("data_class_ban", { classes: ["dna"] }), [], run),
    ).toThrow(/unknown data class/);
  });

  it("covers the ERP's bank fields", () => {
    const erp = rule("data_class_ban", { classes: ["bank_account", "routing_number"] });
    expect(
      dataClassBanChecker.check(
        erp,
        steps({ action: "type", field: "Bank acct" }, { action: "type", field: "Routing" }),
        run,
      ),
    ).toHaveLength(2);
  });
});

describe("max_duration", () => {
  const r = rule("max_duration", { maxMs: 360_000 });

  it("fires on the first step past the limit (D09)", () => {
    const s = steps({ tMs: 100_000 }, { tMs: 370_000 }, { tMs: 420_000 });
    expect(maxDurationChecker.check(r, s, { runId: "run_1", durationMs: 425_000 })).toMatchObject([
      { stepN: 2, detail: "The run took 7:05; the limit is 6:00." },
    ]);
  });

  it("passes under the limit", () => {
    expect(maxDurationChecker.check(r, steps({}), run)).toEqual([]);
  });
});

describe("runChecks", () => {
  it("refuses to check against rules that are not signed off", () => {
    const unsigned = { ...rule("loop_limit", { maxRepeats: 3 }), signedOffBy: null };
    expect(() => runChecks([unsigned], [], run)).toThrow(/not signed off/);
    const unclear = { ...rule("loop_limit", {}), status: "needs_clarification" as const };
    expect(() => runChecks([unclear], [], run)).toThrow(/R1/);
  });

  it("orders findings by step (D02: R2 then R4)", () => {
    const s = steps(
      { target: "button 'Delete selected'" },
      { action: "type", target: "field 'Card number'", field: "Card number" },
    );
    const rules = [
      rule("data_class_ban", { classes: ["payment_card"] }, "R4"),
      rule("confirm_before_destroy", { targets: ["delete"] }, "R2"),
    ];
    expect(runChecks(rules, s, run).map((v) => v.ruleId)).toEqual(["R2", "R4"]);
  });
});

describe("hashDistance", () => {
  it("counts differing bits", () => {
    expect(hashDistance("ff", "fe")).toBe(1);
    expect(hashDistance("00", "ff")).toBe(8);
    expect(hashDistance("0", "00")).toBe(Number.POSITIVE_INFINITY);
  });
});
