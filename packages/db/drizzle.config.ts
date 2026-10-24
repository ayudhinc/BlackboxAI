import { defineConfig } from "drizzle-kit";
import { databaseUrl } from "./src/url.ts";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseUrl() },
});
