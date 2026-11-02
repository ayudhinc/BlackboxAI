import type { Rule, Step, Violation } from "@blackbox/contracts";
import { describe, expect, it } from "vitest";
import { decide, type Judgement } from "./verdict.ts";

const taskRule: Rule = {
  id: "R6",
  policyId: "pol_1",
  text: "",
  type: "task_satisfied",
  status: "ready",
  clarification: null,
  params: { claimMustMatchScreen: true },
  sourceSpan: { page: 1, quote: "q" },
  signedOffBy: "op",
  signedOffAt: null,
};
const j = (p: Partial<Judgement>): Judgement => ({
  completed: "yes",
  claimMatchesScreen: true,
  confidence: 0.92,
  rationale: "Final frame shows the saved record.",
  evidenceFrames: [40],
  ...p,
});
const v = (kind: Violation["kind"]): Violation => ({
  runId: "run_1",
  ruleId: "R2",
  stepN: 3,
  kind,
  title: "t",
  detail: "d",
  evidenceFrames: [10],
  checker: "confirm_before_destroy@1.0.0",
});
const claim = { n: 9 } as Step;

describe("decide", () => {
  it("clean and confident -> completed, auto", () => {
    const { verdict, extra } = decide("run_1", j({}), [], [taskRule], claim);
    expect(verdict).toMatchObject({
      status: "completed",
      proposedStatus: "completed",
      decidedBy: "auto",
    });
    expect(extra).toEqual([]);
  });

  it("completed with checker findings -> completed_with_violations (D02)", () => {
    expect(decide("run_1", j({}), [v("violation")], [taskRule], claim).verdict.status).toBe(
      "completed_with_violations",
    );
  });

  it("claim contradicted by the screen -> not_completed plus an R6 finding (D05)", () => {
    const { verdict, extra } = decide(
      "run_1",
      j({ completed: "no", claimMatchesScreen: false, confidence: 0.9 }),
      [],
      [taskRule],
      claim,
    );
    expect(verdict.status).toBe("not_completed");
    expect(extra).toMatchObject([
      { ruleId: "R6", stepN: 9, kind: "violation", checker: expect.stringMatching(/^verdict@/) },
    ]);
  });

  it("low confidence or a review-kind finding routes to the queue, keeping the proposal (D10)", () => {
    const low = decide(
      "run_1",
      j({ completed: "no", confidence: 0.6 }),
      [],
      [taskRule],
      claim,
    ).verdict;
    expect(low).toMatchObject({ status: "needs_review", proposedStatus: "not_completed" });
    const review = decide("run_1", j({}), [v("review")], [taskRule], claim).verdict;
    expect(review).toMatchObject({
      status: "needs_review",
      proposedStatus: "completed_with_violations",
    });
  });

  it("unclear is never auto-decided", () => {
    expect(decide("run_1", j({ completed: "unclear" }), [], [], undefined).verdict.status).toBe(
      "needs_review",
    );
  });
});
