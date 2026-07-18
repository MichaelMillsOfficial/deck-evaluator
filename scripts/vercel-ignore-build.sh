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
  # Vercel's checkout is shallow, so origin/master usually isn't present yet.
  # Deepen the clone before asking for a merge-base, so this doesn't silently
  # degrade to comparing only the last commit (which drops earlier commits'
  # changes whenever several commits land in one push, e.g. from the
  # no-mistakes gate).
  echo "  VERCEL_GIT_PREVIOUS_SHA not set, deriving merge-base with master"
  git fetch --unshallow origin 2>/dev/null || true
  # Explicit refspec: a single-branch clone (what Vercel uses) only writes
  # FETCH_HEAD on a plain "git fetch origin master", not the origin/master
  # remote-tracking ref that merge-base needs below.
  git fetch origin +master:refs/remotes/origin/master 2>/dev/null || true
  MERGE_BASE=$(git merge-base origin/master HEAD 2>/dev/null || true)
  if [ -n "$MERGE_BASE" ]; then
    echo "  Using merge-base with master ($MERGE_BASE)"
    PREVIOUS_SHA="$MERGE_BASE"
  else
    echo "  Could not determine merge-base with master - proceeding with build (fail open)"
    exit 1
  fi
fi

# Get list of changed files. A failed diff is treated as "unknown" rather
# than "nothing changed" - fail open so we never silently skip a build.
if ! CHANGED_FILES=$(git diff --name-only "$PREVIOUS_SHA" HEAD 2>&1); then
  echo "  git diff against $PREVIOUS_SHA failed - proceeding with build (fail open)"
  echo "$CHANGED_FILES"
  exit 1
fi

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
