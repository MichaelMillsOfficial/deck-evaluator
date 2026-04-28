#!/bin/bash
# Vercel Ignored Build Step
# https://vercel.com/docs/projects/overview#ignored-build-step
#
# Exit 1 = proceed with build (app code changed)
# Exit 0 = skip build (only tests, docs, or CI config changed)

set -euo pipefail

# Always build production deploys. Release pipeline triggers prod via
# deploy hook; Vercel doesn't set VERCEL_GIT_PREVIOUS_SHA for hook-driven
# deploys, so the diff fallback below would compare master..master, see
# zero changed files, and skip the release. Skipping production releases
# is never the right call.
if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "✓ Production deploy — always proceeding with build"
  exit 1
fi

echo "→ Checking if app code changed..."

# Paths that should trigger a build
APP_PATHS=(
  "src/"
  "public/"
  "package.json"
  "package-lock.json"
  "next.config.ts"
  "tsconfig.json"
  "postcss.config.mjs"
  "eslint.config.mjs"
  "vercel.json"
  "Dockerfile"
  "docker-compose.yml"
  "scripts/"
)

# Use Vercel-provided previous SHA, fall back to merge base with master
PREVIOUS_SHA="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$PREVIOUS_SHA" ]; then
  # On first push of a branch, compare against the merge base with master
  # so we see ALL changes in the branch, not just the last commit
  MERGE_BASE=$(git merge-base origin/master HEAD 2>/dev/null || true)
  if [ -n "$MERGE_BASE" ]; then
    echo "  VERCEL_GIT_PREVIOUS_SHA not set, using merge-base with master ($MERGE_BASE)"
    PREVIOUS_SHA="$MERGE_BASE"
  else
    echo "  VERCEL_GIT_PREVIOUS_SHA not set, using HEAD^"
    PREVIOUS_SHA="HEAD^"
  fi
fi

# Get list of changed files
CHANGED_FILES=$(git diff --name-only "$PREVIOUS_SHA" HEAD 2>/dev/null || true)

if [ -z "$CHANGED_FILES" ]; then
  echo "  No changed files detected — skipping build"
  exit 0
fi

echo "  Changed files:"
echo "$CHANGED_FILES" | sed 's/^/    /'

# Check if any changed file matches an app path
for file in $CHANGED_FILES; do
  for pattern in "${APP_PATHS[@]}"; do
    if [[ "$file" == "$pattern" || "$file" == "$pattern"* ]]; then
      echo ""
      echo "✓ App code changed ($file) — proceeding with build"
      exit 1
    fi
  done
done

echo ""
echo "○ No app code changed — skipping build"
exit 0
