import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal self-contained server in .next/standalone for Docker
  output: "standalone",
  // Force-include packages needed at runtime for `prisma migrate deploy` that
  // aren't traced by Next.js (the CLI isn't imported by any app code).
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/prisma/**/*",
      "./node_modules/@prisma/**/*",
      "./node_modules/dotenv/**/*",
      "./node_modules/tsx/**/*",
    ],
  },
};

export default nextConfig;
