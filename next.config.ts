import type { NextConfig } from "next";
import { execSync } from "child_process";
import { readFileSync } from "fs";

function getGitTag(): string {
  try {
    return execSync("git describe --tags --always", { encoding: "utf-8" }).trim();
  } catch {
    // Vercel provides the commit SHA as an env var
    const sha = process.env.VERCEL_GIT_COMMIT_SHA;
    return sha ? sha.slice(0, 7) : "unknown";
  }
}

function getReleaseVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
    return `v${pkg.version}`;
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
