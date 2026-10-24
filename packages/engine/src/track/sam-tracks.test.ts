import { parseVideoStream } from "@meta-sam/parser";
import { describe, expect, it } from "vitest";
import { samEvents } from "../meta/testing.ts";
import { tracksFromSam } from "./sam-tracks.ts";

const mask = "<|mask;x=0;y=0;data=5,5,!!!!!(QO(0lu8?|>";
const text = [
  // Out of frame order, as SAM may emit when propagating both ways.
  `<4f>3<|box;x1=12;y1=20;x2=31;y2=39;w=320;h=240;c=0.8|>${mask}`,
  `<0f>3<|box;x1=10;y1=20;x2=29;y2=39;w=320;h=240;c=0.9|>${mask},7<|box;x1=100;y1=100;x2=199;y2=149;w=320;h=240|>${mask}`,
  "",
].join("\n");

describe("tracksFromSam", () => {
  it("groups boxes by object, sorts by frame and maps frames to time", async () => {
    const result = await parseVideoStream(
      (async function* () {
        yield* samEvents(text, 50);
      })(),
    ).finalResult;
    const tracks = tracksFromSam("run_1", "modal dialog", result, 2);
    expect(tracks.map((t) => t.objectId)).toEqual(["3", "7"]);
    expect(tracks[0]?.frames.map((f) => [f.frame, f.tMs])).toEqual([
      [0, 0],
      [4, 2000],
    ]);
    // Wire x2/y2 are inclusive; tracks hold half-open boxes.
    expect(tracks[0]?.frames[0]?.box).toEqual([10, 20, 30, 40]);
    expect(tracks[1]?.frames[0]?.confidence).toBeNull();
  });

  it("returns no tracks for an empty response", async () => {
    const result = await parseVideoStream(
      (async function* () {
        yield* samEvents("", 50);
      })(),
    ).finalResult;
    expect(tracksFromSam("run_1", "cursor", result, 2)).toEqual([]);
  });

  it("rejects a non-positive fps", async () => {
    const result = await parseVideoStream(
      (async function* () {
        yield* samEvents("", 50);
      })(),
    ).finalResult;
    expect(() => tracksFromSam("run_1", "cursor", result, 0)).toThrow(/fps/);
  });
});
