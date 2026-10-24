/**
 * Day-1 probe: Muse Spark 1.3 structured output on one screenshot.
 * Usage: pnpm --filter @blackbox/scripts probe:spark <screenshot.png>
 * Billed. Writes one lineage row per attempt to the database.
 */
import { readFile } from "node:fs/promises";
import { connect } from "@blackbox/db";
import { createMetaTransport, DbLineageSink, MetaClient } from "@blackbox/engine";
import { z } from "zod";
import { loadEnv } from "./env.ts";

const ScreenReading = z.object({
  app: z.string().describe("The application shown, e.g. a CRM or a browser start page"),
  screenTitle: z.string().describe("The page or window title as shown on screen"),
  dialogOpen: z.boolean().describe("True if a modal or confirmation dialog is visible"),
  errorShown: z.string().nullable().describe("Text of any visible error message, else null"),
  controls: z
    .array(
      z.object({
        role: z.enum(["button", "link", "text_field", "checkbox", "menu", "tab", "other"]),
        label: z.string(),
      }),
    )
    .describe("Interactive controls visible on screen, top to bottom"),
});

loadEnv();
const path = process.argv[2];
if (!path) throw new Error("Usage: probe-spark <screenshot.png>");
const image = await readFile(path);
const { db, close } = connect();
try {
  const client = new MetaClient(createMetaTransport(), new DbLineageSink(db));
  const started = performance.now();
  const reading = await client.structured({
    subject: { stage: "probe" },
    schemaName: "screen_reading",
    schema: ScreenReading,
    messages: [
      {
        role: "system",
        content:
          "You read screenshots of software for an audit tool. Report only what is visible. Do not guess hidden state.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this screen." },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${image.toString("base64")}` },
          },
        ],
      },
    ],
  });
  console.log(JSON.stringify(reading, null, 2));
  console.log(`latency ${Math.round(performance.now() - started)} ms`);
} finally {
  await close();
}
