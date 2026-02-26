#!/bin/bash
# Vercel Ignored Build Step
# https://vercel.com/docs/projects/overview#ignored-build-step
#
# Exit 1 = proceed with build (app code changed)
# Exit 0 = skip build (only tests, docs, or CI config changed)

set -euo pipefail

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
)

# Use Vercel-provided previous SHA, fall back to HEAD^
PREVIOUS_SHA="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$PREVIOUS_SHA" ]; then
  echo "  VERCEL_GIT_PREVIOUS_SHA not set, using HEAD^"
  PREVIOUS_SHA="HEAD^"
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
