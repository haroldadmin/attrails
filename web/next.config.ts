import { existsSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Try to use the repository-wide .env file
const rootEnvFile = path.resolve(process.cwd(), "../.env");
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
