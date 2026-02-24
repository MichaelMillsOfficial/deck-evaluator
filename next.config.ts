import type { NextConfig } from "next";
import { execSync } from "child_process";

function getGitTag(): string {
  try {
    return execSync("git describe --tags --always", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

function getReleaseVersion(): string {
  try {
    return execSync("git describe --tags --abbrev=0", { encoding: "utf-8" }).trim();
  } catch {
    return "alpha";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_TAG: getGitTag(),
    NEXT_PUBLIC_RELEASE_VERSION: getReleaseVersion(),
  },
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cards.scryfall.io" },
    ],
  },
};

export default nextConfig;
