import type { NextConfig } from "next";

const config: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@blackbox/contracts", "@blackbox/db"],
  serverExternalPackages: ["pg"],
};

export default config;
