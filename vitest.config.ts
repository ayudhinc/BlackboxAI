import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    // Tests must never reach a billed API. The Meta client refuses to build a
    // real transport while this is set; see packages/engine/src/meta/client.ts.
    env: { BLACKBOX_TEST: "1" },
  },
});
