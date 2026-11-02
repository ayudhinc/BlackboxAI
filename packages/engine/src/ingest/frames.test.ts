import { describe, expect, it } from "vitest";
import { hashDistance, SAME_SCREEN_BITS } from "../check/checkers.ts";
import {
  changedPixels,
  DIFF_H,
  DIFF_W,
  screenIdentities,
  screenSignature,
  selectKeyframes,
  THUMB_H,
  THUMB_W,
} from "./frames.ts";

function frame(fill: (x: number, y: number) => number): Uint8Array {
  const a = new Uint8Array(THUMB_W * THUMB_H);
  for (let y = 0; y < THUMB_H; y++)
    for (let x = 0; x < THUMB_W; x++) a[y * THUMB_W + x] = fill(x, y);
  return a;
}
const page = frame((x, y) => (y < 5 ? 30 : x > 10 && x < 40 && y > 15 && y < 22 ? 200 : 240));
const pageWithCursor = (() => {
  const f = page.slice();
  f[30 * THUMB_W + 50] = 0; // a two-pixel cursor
  f[31 * THUMB_W + 50] = 0;
  return f;
})();
const dialog = frame((x, y) => (x > 20 && x < 44 && y > 12 && y < 28 ? 255 : 120));

describe("screenSignature", () => {
  it("is 16 hex chars and stable when only the cursor moves", () => {
    const a = screenSignature(page);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(hashDistance(a, screenSignature(pageWithCursor))).toBeLessThanOrEqual(SAME_SCREEN_BITS);
  });

  it("changes when a dialog covers the page", () => {
    expect(hashDistance(screenSignature(page), screenSignature(dialog))).toBeGreaterThan(
      SAME_SCREEN_BITS,
    );
  });

  it("rejects the wrong size", () => {
    expect(() => screenSignature(new Uint8Array(10))).toThrow(/gray bytes/);
  });
});

describe("selectKeyframes", () => {
  const blank = new Uint8Array(DIFF_W * DIFF_H).fill(240);
  const withPixels = (n: number, offset = 0) => {
    const f = blank.slice();
    for (let i = 0; i < n; i++) f[offset + i] = 20;
    return f;
  };

  it("ignores cursor-sized changes, keeps typing, screen changes, the gap floor and the last frame", () => {
    const cursor = withPixels(8, 5000);
    const typed = withPixels(25, 100);
    const dialog = withPixels(4000, 2000);
    const thumbs = [blank, cursor, blank, typed, typed, dialog, ...Array(25).fill(dialog)];
    expect(selectKeyframes(thumbs, { levels: 16, minChanged: 20, maxGap: 20 })).toEqual([
      0, 3, 5, 25, 30,
    ]);
    expect(changedPixels(blank, cursor, 16)).toBe(8);
  });

  it("handles empty and single-frame input", () => {
    expect(selectKeyframes([])).toEqual([]);
    expect(selectKeyframes([blank])).toEqual([0]);
  });
});

describe("screenIdentities", () => {
  const blank = new Uint8Array(DIFF_W * DIFF_H).fill(240);
  const variant = (offset: number, n: number) => {
    const f = blank.slice();
    for (let i = 0; i < n; i++) f[offset + i] = 20;
    return f;
  };

  it("gives the same id to the same screen, a new id to a different one, and remembers screens", () => {
    const cursorMoved = variant(9000, 6);
    const dealA = variant(1000, 60);
    const dealB = variant(3000, 60);
    expect(screenIdentities([blank, cursorMoved, dealA, dealB, blank, dealA])).toEqual([
      "s0",
      "s0",
      "s1",
      "s2",
      "s0",
      "s1",
    ]);
  });
});
