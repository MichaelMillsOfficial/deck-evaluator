import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cards.scryfall.io" },
    ],
  },
};

export default nextConfig;
