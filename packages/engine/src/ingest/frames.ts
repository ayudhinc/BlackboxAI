/**
 * Pure frame analysis over small grayscale thumbnails: screen signatures for
 * loop detection and keyframe selection by frame difference.
 */

export const THUMB_W = 64;
export const THUMB_H = 40;

/**
 * 64-bit average hash of a THUMB_W×THUMB_H grayscale frame, as 16 hex chars.
 * Blocks of 8×5 pixels are averaged, so a moving cursor flips few bits.
 */
export function screenSignature(gray: Uint8Array): string {
  if (gray.length !== THUMB_W * THUMB_H) {
    throw new Error(`expected ${THUMB_W * THUMB_H} gray bytes, got ${gray.length}`);
  }
  const bw = THUMB_W / 8;
  const bh = THUMB_H / 8;
  const blocks: number[] = [];
  for (let by = 0; by < 8; by++) {
    for (let bx = 0; bx < 8; bx++) {
      let sum = 0;
      for (let y = by * bh; y < (by + 1) * bh; y++) {
        for (let x = bx * bw; x < (bx + 1) * bw; x++) sum += gray[y * THUMB_W + x] as number;
      }
      blocks.push(sum / (bw * bh));
    }
  }
  const mean = blocks.reduce((a, b) => a + b, 0) / blocks.length;
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4; j++) nibble = (nibble << 1) | ((blocks[i + j] as number) > mean ? 1 : 0);
    hex += nibble.toString(16);
  }
  return hex;
}

/** Thumbnail size for keyframe selection: fine enough that typed text registers. */
export const DIFF_W = 160;
export const DIFF_H = 100;

/** Pixels that changed by more than `levels` grey levels between two thumbnails. */
export function changedPixels(a: Uint8Array, b: Uint8Array, levels: number): number {
  if (a.length !== b.length) throw new Error("thumbnails differ in size");
  let n = 0;
  for (let i = 0; i < a.length; i++)
    if (Math.abs((a[i] as number) - (b[i] as number)) > levels) n++;
  return n;
}

export type KeyframeOptions = {
  /** Grey-level change that counts a pixel as changed. */
  levels: number;
  /**
   * Changed pixels, against the last keyframe, that make a new keyframe. On
   * the day-1 probe (160×100), cursor motion changed 3–10 pixels per frame,
   * typing 13–26 and screen changes 129+.
   */
  minChanged: number;
  /**
   * Keep at least one keyframe every this many frames. Repeated clicks that
   * change nothing on screen (D06: Save pressed four times) are only visible
   * as a sequence, so the floor is two seconds at 2 fps.
   */
  maxGap: number;
};

export const DEFAULT_KEYFRAMES: KeyframeOptions = { levels: 16, minChanged: 20, maxGap: 4 };

/**
 * Pick keyframes from DIFF_W×DIFF_H thumbnails: the first frame, every frame
 * that differs enough from the last keyframe, at least one every maxGap
 * frames, and the last frame (where completion is judged).
 */
export function selectKeyframes(
  thumbs: Uint8Array[],
  options: KeyframeOptions = DEFAULT_KEYFRAMES,
): number[] {
  if (thumbs.length === 0) return [];
  const keys = [0];
  let last = 0;
  for (let i = 1; i < thumbs.length; i++) {
    const changed =
      changedPixels(thumbs[last] as Uint8Array, thumbs[i] as Uint8Array, options.levels) >=
      options.minChanged;
    if (changed || i - last >= options.maxGap) {
      keys.push(i);
      last = i;
    }
  }
  if (keys.at(-1) !== thumbs.length - 1) keys.push(thumbs.length - 1);
  return keys;
}

/**
 * Group frames into screen identities: a frame joins the first earlier group
 * whose representative differs from it by fewer than `minChanged` pixels, or
 * starts a new one. Two frames with the same id show the same screen, down to
 * the text on it, so D09's six deal pages are six screens while a moving
 * cursor is not a new one. Returns one id per frame ("s0", "s1", ...).
 */
export function screenIdentities(
  thumbs: Uint8Array[],
  options: KeyframeOptions = DEFAULT_KEYFRAMES,
): string[] {
  const reps: Uint8Array[] = [];
  const ids: string[] = [];
  let last = -1;
  for (const t of thumbs) {
    const same = (g: number) =>
      changedPixels(reps[g] as Uint8Array, t, options.levels) < options.minChanged;
    let group = last >= 0 && same(last) ? last : -1;
    for (let g = 0; group < 0 && g < reps.length; g++) if (g !== last && same(g)) group = g;
    if (group < 0) {
      reps.push(t);
      group = reps.length - 1;
    }
    ids.push(`s${group}`);
    last = group;
  }
  return ids;
}
