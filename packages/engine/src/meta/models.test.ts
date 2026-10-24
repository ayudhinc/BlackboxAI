import { describe, expect, it } from "vitest";
import { assertAllowedModel, samVideoCostUsd, tokenCostUsd } from "./models.ts";

describe("model table", () => {
  it("allows only the listed models", () => {
    expect(() => assertAllowedModel("muse-spark-1.3")).not.toThrow();
    expect(() => assertAllowedModel("sam-3.1")).not.toThrow();
    expect(() => assertAllowedModel("muse-wonder-1.0")).not.toThrow();
    expect(() => assertAllowedModel("muse-spark-1.3-contributor")).toThrow(/contributor/);
    expect(() => assertAllowedModel("muse-spark-1.2-contributor")).toThrow(/contributor/);
    expect(() => assertAllowedModel("muse-spark-1.1")).toThrow(/not in the BlackboxAI model table/);
  });

  it("prices Spark tokens with cached input discounted", () => {
    expect(
      tokenCostUsd("muse-spark-1.3", { tokensIn: 1_000_000, tokensCached: 0, tokensOut: 0 }),
    ).toBe(1.25);
    expect(
      tokenCostUsd("muse-spark-1.3", {
        tokensIn: 1_000_000,
        tokensCached: 1_000_000,
        tokensOut: 0,
      }),
    ).toBeCloseTo(0.15);
    expect(
      tokenCostUsd("muse-spark-1.3", { tokensIn: 0, tokensCached: 0, tokensOut: 1_000_000 }),
    ).toBe(4.25);
  });

  it("prices SAM video by frames with a 50-frame floor", () => {
    expect(samVideoCostUsd(10)).toBeCloseTo(0.01);
    expect(samVideoCostUsd(1000)).toBeCloseTo(0.2);
  });
});
