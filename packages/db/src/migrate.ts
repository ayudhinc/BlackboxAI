import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { connect } from "./index.ts";

const handle = connect();
try {
  await migrate(handle.db, {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
  console.log("migrations applied");
} finally {
  await handle.close();
}
