import { getTableColumns, getTableName, is } from "drizzle-orm";
import { type PgColumn, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema.ts";

/**
 * Plain text() columns that are allowed because they hold an identifier, a
 * key or a fixed vocabulary, never free text. Columns with an enum are allowed
 * without being listed. Anything else must be freeText().
 */
const PLAIN_TEXT = new Set([
  "policies.id",
  "policies.source_key",
  "rules.policy_id",
  "rules.id",
  "rules.signed_off_by",
  "runs.id",
  "runs.task_id",
  "runs.agent_vendor",
  "runs.agent_model",
  "runs.policy_id",
  "runs.recording_key",
  "steps.run_id",
  "steps.screen_signature",
  "ui_tracks.run_id",
  "ui_tracks.phrase",
  "ui_tracks.object_id",
  "runtime_events.run_id",
  "runtime_events.event",
  "runtime_events.role",
  "violations.id",
  "violations.run_id",
  "violations.rule_id",
  "violations.title",
  "violations.checker",
  "verdicts.id",
  "verdicts.run_id",
  "verdicts.reviewer",
  "lineage.id",
  "lineage.run_id",
  "lineage.policy_id",
  "lineage.stage",
  "lineage.engine",
  "lineage.prompt_hash",
  "jobs.id",
  "jobs.kind",
  "jobs.subject_id",
  "jobs.locked_by",
]);

/** Better Auth owns these tables; redacting a token or password hash would break sign-in. */
const AUTH_TABLES = new Set(["user", "session", "account", "verification"]);

const tables = (Object.values(schema) as unknown[]).filter((v): v is PgTable => is(v, PgTable));

describe("free-text columns", () => {
  it("redacts card, SSN and account numbers on write", () => {
    const col = schema.runs.task as unknown as PgColumn;
    expect(col.mapToDriverValue("Put card 4242 4242 4242 4242 on file.")).toBe(
      "Put card [redacted] on file.",
    );
    expect(col.mapToDriverValue("SSN 123-45-6789, account 000123456789")).toBe(
      "SSN [redacted], account [redacted]",
    );
    expect(col.mapToDriverValue("Call +1 415 555 0143 about $12,860.00")).toBe(
      "Call +1 415 555 0143 about $12,860.00",
    );
  });

  it("covers every text column that is not an identifier or a fixed vocabulary", () => {
    const plain: string[] = [];
    for (const table of tables) {
      const name = getTableName(table);
      if (AUTH_TABLES.has(name)) continue;
      for (const col of Object.values(getTableColumns(table)) as PgColumn[]) {
        if (col.columnType !== "PgText" || (col.enumValues?.length ?? 0) > 0) continue;
        plain.push(`${name}.${col.name}`);
      }
    }
    expect(plain.length).toBeGreaterThan(0);
    expect(plain.filter((c) => !PLAIN_TEXT.has(c))).toEqual([]);
  });
});
