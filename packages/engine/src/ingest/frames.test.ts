import { describe, expect, it } from "vitest";
import { hashDistance, SAME_SCREEN_BITS } from "../check/checkers.ts";
import { frameDiff, screenSignature, selectKeyframes, THUMB_H, THUMB_W } from "./frames.ts";

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
  it("keeps the first frame, screen changes, the gap floor and the last frame", () => {
    const thumbs = [page, pageWithCursor, page, dialog, dialog, page, ...Array(25).fill(page)];
    const keys = selectKeyframes(thumbs, { threshold: 1.5, maxGap: 20 });
    expect(keys).toEqual([0, 3, 5, 25, 30]);
    expect(frameDiff(page, pageWithCursor)).toBeLessThan(1.5);
  });

  it("handles empty and single-frame input", () => {
    expect(selectKeyframes([])).toEqual([]);
    expect(selectKeyframes([page])).toEqual([0]);
  });
});
