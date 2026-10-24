import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export type VideoInfo = {
  codec: string;
  width: number;
  height: number;
  fps: number;
  frames: number;
  durationMs: number;
};

/** ffprobe the first video stream. Fails loudly on anything SAM cannot read. */
export async function probeVideo(path: string): Promise<VideoInfo> {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-count_packets",
    "-show_entries",
    "stream=codec_name,width,height,avg_frame_rate,nb_read_packets:format=duration",
    "-of",
    "json",
    path,
  ]);
  const json = JSON.parse(stdout) as {
    streams?: Array<Record<string, string | number>>;
    format?: { duration?: string };
  };
  const s = json.streams?.[0];
  if (!s) throw new Error(`${path} has no video stream`);
  const [num, den] = String(s.avg_frame_rate).split("/").map(Number);
  const fps = num && den ? num / den : Number.NaN;
  const info: VideoInfo = {
    codec: String(s.codec_name),
    width: Number(s.width),
    height: Number(s.height),
    fps,
    frames: Number(s.nb_read_packets),
    durationMs: Math.round(Number(json.format?.duration) * 1000),
  };
  if (!["h264", "hevc", "mpeg4"].includes(info.codec)) {
    throw new Error(`${path}: codec ${info.codec} is not accepted by SAM (H.264, H.265 or MPEG-4)`);
  }
  if (!(info.fps > 0) || !(info.frames > 0))
    throw new Error(`${path}: could not read fps or frame count`);
  return info;
}
