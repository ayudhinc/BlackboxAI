import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Repository root, resolved from this file. */
export const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Load the repo's .env into process.env if it exists. Read-only: never writes the file. */
export function loadEnv(): void {
  const path = `${ROOT}.env`;
  if (existsSync(path)) process.loadEnvFile(path);
}
