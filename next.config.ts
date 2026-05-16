import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal self-contained server in .next/standalone for Docker
  output: "standalone",
  // CSV imports can carry several thousand rows; default Server Action body
  // limit is 1 MB which gets tight for 5k+ persons.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
