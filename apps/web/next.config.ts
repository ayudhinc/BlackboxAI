import type { NextConfig } from "next";

const config: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@blackbox/contracts", "@blackbox/db", "@blackbox/engine"],
  serverExternalPackages: ["pg", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
};

export default config;
