import { createHash } from "node:crypto";
import { LineageEntry, newId, type Stage } from "@blackbox/contracts";
import { type Db, schema } from "@blackbox/db";

/** Where lineage rows go. Every Meta call writes exactly one row per attempt. */
export interface LineageSink {
  write(entry: LineageEntry): Promise<void>;
}

export class DbLineageSink implements LineageSink {
  constructor(private readonly db: Db) {}

  async write(entry: LineageEntry): Promise<void> {
    const e = LineageEntry.parse(entry);
    await this.db.insert(schema.lineage).values({ ...e, createdAt: new Date(e.createdAt) });
  }
}

export class MemoryLineageSink implements LineageSink {
  readonly entries: LineageEntry[] = [];

  async write(entry: LineageEntry): Promise<void> {
    this.entries.push(LineageEntry.parse(entry));
  }
}

/** Who a call is for: a run, a policy, or neither (probes, agent runs). */
export type CallSubject = { stage: Stage; runId?: string | null; policyId?: string | null };

export function lineageEntry(
  subject: CallSubject,
  fields: Partial<Omit<LineageEntry, "id" | "stage" | "runId" | "policyId">> &
    Pick<LineageEntry, "engine" | "costUsd" | "latencyMs" | "attempt">,
): LineageEntry {
  return {
    id: newId("lineage"),
    stage: subject.stage,
    runId: subject.runId ?? null,
    policyId: subject.policyId ?? null,
    promptHash: null,
    tokensIn: null,
    tokensCached: null,
    tokensOut: null,
    frames: null,
    error: null,
    createdAt: new Date().toISOString(),
    ...fields,
  };
}

/** sha256 over a canonical JSON form, so the same request hashes the same. */
export function promptHash(request: unknown): string {
  return createHash("sha256").update(canonicalJson(request)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}
