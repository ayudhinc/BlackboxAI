import { describe, expect, it } from "vitest";
import { promptHash } from "./lineage.ts";

describe("promptHash", () => {
  it("ignores key order and undefined fields", () => {
    expect(promptHash({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(
      promptHash({ b: [1, { d: 3, c: 2 }], a: 1, e: undefined }),
    );
  });

  it("changes when content changes", () => {
    expect(promptHash({ a: 1 })).not.toBe(promptHash({ a: 2 }));
  });
});
