import type { Rule } from "@blackbox/contracts";
import { describe, expect, it } from "vitest";
import { type CompiledPolicy, resolveRule, toRules } from "./compile.ts";

const base = {
  status: "ready" as const,
  clarification: null,
  readBack: "r",
  sourcePage: 1,
  sourceQuote: "q",
  apps: null,
  hosts: null,
  targets: null,
  dialogWithinMs: null,
  maxRepeats: null,
  classes: null,
  maxMs: null,
};

describe("toRules", () => {
  it("builds typed params and applies the stated dialog default", () => {
    const compiled: CompiledPolicy = {
      title: "CRM",
      rules: [
        { ...base, type: "app_allowlist", apps: ["Acme CRM"], hosts: ["crm.acme.test"] },
        { ...base, type: "confirm_before_destroy", targets: ["delete"] },
        { ...base, type: "loop_limit", maxRepeats: 3 },
        { ...base, type: "data_class_ban", classes: ["payment_card"] },
        { ...base, type: "max_duration", maxMs: 360000 },
        { ...base, type: "task_satisfied" },
      ],
    };
    const rules = toRules("pol_1", compiled);
    expect(rules.map((r) => [r.id, r.status])).toEqual([
      ["R1", "ready"],
      ["R2", "ready"],
      ["R3", "ready"],
      ["R4", "ready"],
      ["R5", "ready"],
      ["R6", "ready"],
    ]);
    expect(rules[1]?.params).toEqual({ targets: ["delete"], dialogWithinMs: 3000 });
    expect(rules.every((r) => r.signedOffBy === null)).toBe(true);
  });

  it("turns a ready rule with a missing number into a question, never a default (ERP §3)", () => {
    const [rule] = toRules("pol_2", { title: "ERP", rules: [{ ...base, type: "loop_limit" }] });
    expect(rule).toMatchObject({ status: "needs_clarification", params: {} });
    expect(rule?.clarification).toMatch(/loop limit/);
  });

  it("keeps the model's question when it asks one", () => {
    const [rule] = toRules("pol_2", {
      title: "ERP",
      rules: [
        {
          ...base,
          type: "loop_limit",
          status: "needs_clarification",
          clarification: "How many resubmissions?",
        },
      ],
    });
    expect(rule?.clarification).toBe("How many resubmissions?");
  });
});

describe("resolveRule", () => {
  const unclear = toRules("pol_2", {
    title: "ERP",
    rules: [{ ...base, type: "loop_limit" }],
  })[0] as Rule;

  it("resolves with valid params", () => {
    expect(
      resolveRule(unclear, { maxRepeats: 2 }, "More than twice is a violation."),
    ).toMatchObject({
      status: "ready",
      params: { maxRepeats: 2 },
      clarification: null,
    });
  });

  it("fails loudly on invalid params", () => {
    expect(() => resolveRule(unclear, { maxRepeats: 0 })).toThrow(/Invalid parameters for R1/);
  });
});
