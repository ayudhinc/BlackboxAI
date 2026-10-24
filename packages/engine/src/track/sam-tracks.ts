/**
 * The one place SAM's parsed output becomes our UiTrack contract. SAM's output
 * grammar is young; if it changes, this module and @meta-sam/parser change and
 * nothing downstream does.
 */
import { type UiTrack, UiTrack as UiTrackSchema } from "@blackbox/contracts";
import { frameIndexOf, recordsOfKind, type VideoSegmentationResult } from "@meta-sam/parser";

/**
 * Group SAM box records into one track per object, in frame order.
 * `fps` is the source clip's frame rate, which maps SAM's frame index to time.
 * An object SAM never reported is absent from the result: "not observed", not "absent".
 */
export function tracksFromSam(
  runId: string,
  phrase: string,
  result: VideoSegmentationResult,
  fps: number,
): UiTrack[] {
  if (!(fps > 0)) throw new Error(`fps must be positive, got ${fps}`);
  const byObject = new Map<string, UiTrack["frames"]>();
  for (const box of recordsOfKind(result.records, "box")) {
    const frame = frameIndexOf(box);
    if (frame === undefined)
      throw new Error(`SAM box for object ${box.objectId} has no frame index`);
    const frames = byObject.get(box.objectId) ?? [];
    frames.push({
      frame,
      tMs: Math.round((frame * 1000) / fps),
      box: [box.left, box.top, box.right, box.bottom],
      confidence: box.confidence ?? null,
    });
    byObject.set(box.objectId, frames);
  }
  return [...byObject.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([objectId, frames]) =>
      UiTrackSchema.parse({
        runId,
        phrase,
        objectId,
        frames: frames.sort((a, b) => a.frame - b.frame),
      }),
    );
}
