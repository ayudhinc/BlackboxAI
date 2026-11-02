/**
 * Create the local development operator from scripts/fixtures/dev-operator.json.
 * Refuses to run against any database but the local compose Postgres, so these
 * test credentials can never exist in a hosted environment.
 *   pnpm seed-dev-operator
 */
import { readFile } from "node:fs/promises";
import { createAuth, createOperator } from "@blackbox/auth";
import { connect, databaseUrl, LOCAL_DATABASE_URL } from "@blackbox/db";
import { loadEnv, ROOT } from "./env.ts";

loadEnv();
if (databaseUrl() !== LOCAL_DATABASE_URL) {
  throw new Error(
    "seed-dev-operator only runs against the local compose Postgres (127.0.0.1:5476).",
  );
}
const fixture = JSON.parse(await readFile(`${ROOT}scripts/fixtures/dev-operator.json`, "utf8")) as {
  email: string;
  name: string;
  password: string;
};
const { db, close } = connect();
try {
  const id = await createOperator(createAuth(db), fixture);
  console.log(`Created local operator ${fixture.email} (${id}).`);
} finally {
  await close();
}
