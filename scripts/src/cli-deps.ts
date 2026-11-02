import { connect, type DbHandle } from "@blackbox/db";
import {
  createMetaTransport,
  DbLineageSink,
  defaultLocalStore,
  MetaClient,
  type PipelineDeps,
} from "@blackbox/engine";
import { loadEnv, ROOT } from "./env.ts";

/** Real dependencies for CLI commands: local Postgres, local blob store, billed Meta client. */
export function cliDeps(): PipelineDeps & { handle: DbHandle } {
  loadEnv();
  const handle = connect();
  const lineage = new DbLineageSink(handle.db);
  return {
    handle,
    db: handle.db,
    lineage,
    client: new MetaClient(createMetaTransport(), lineage),
    store: defaultLocalStore(ROOT),
    workRoot: `${ROOT}.data/work`,
    log: (m) => console.log(`  ${m}`),
  };
}
