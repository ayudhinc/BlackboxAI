/**
 * Redact sensitive numbers in rows written before every free-text column was
 * a freeText() column. Reads each such column, and with --apply writes back
 * the rows whose text changes (freeText redacts on the way in). Prints counts
 * only, never the values.
 *
 *   pnpm --filter @blackbox/scripts redact-stored          # dry run
 *   pnpm --filter @blackbox/scripts redact-stored --apply
 */
import { redact } from "@blackbox/contracts";
import { connect, schema } from "@blackbox/db";
import { and, eq, getTableColumns, getTableName, is } from "drizzle-orm";
import { getTableConfig, type PgColumn, PgTable } from "drizzle-orm/pg-core";
import { loadEnv } from "./env.ts";

loadEnv();
const apply = process.argv.includes("--apply");

const tables = (Object.values(schema) as unknown[]).filter((v): v is PgTable => is(v, PgTable));

const { db, close } = connect();
let total = 0;
try {
  for (const table of tables) {
    const columns = Object.entries(getTableColumns(table)) as [string, PgColumn][];
    const free = columns.filter(([, c]) => c.columnType === "PgCustomColumn");
    if (free.length === 0) continue;
    const config = getTableConfig(table);
    const keyCols =
      config.primaryKeys[0]?.columns ?? columns.filter(([, c]) => c.primary).map(([, c]) => c);
    if (keyCols.length === 0) throw new Error(`${getTableName(table)} has no primary key`);
    const keyProps = keyCols.map((k) => columns.find(([, c]) => c === k)?.[0] as string);

    const rows = (await db.select().from(table)) as Record<string, unknown>[];
    for (const row of rows) {
      const changed = free.filter(
        ([prop]) => typeof row[prop] === "string" && redact(row[prop] as string).changed,
      );
      if (changed.length === 0) continue;
      total++;
      console.log(
        `${getTableName(table)} ${keyProps.map((p) => row[p]).join("/")}: ${changed.map(([, c]) => c.name).join(", ")}`,
      );
      if (!apply) continue;
      const set = Object.fromEntries(changed.map(([prop]) => [prop, row[prop]]));
      await db
        .update(table)
        .set(set)
        .where(and(...keyCols.map((k, i) => eq(k, row[keyProps[i] as string]))));
    }
  }
  console.log(
    `${total} row(s) ${apply ? "redacted" : "would be redacted (dry run; pass --apply)"}`,
  );
} finally {
  await close();
}
