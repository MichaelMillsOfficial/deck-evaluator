#!/bin/bash
# Vercel Ignored Build Step
# https://vercel.com/docs/projects/overview#ignored-build-step
#
# Exit 0 = skip build, Exit 1 = proceed with build
#
# Policy:
#   - Preview deploys: always build (so PRs get previews)
#   - Production deploys: only build on version-bump commits from the
#     release workflow (commit message starts with "chore: bump version to")

if [ "$VERCEL_ENV" != "production" ]; then
  echo "✓ Preview deploy — proceeding with build"
  exit 1
fi

COMMIT_MSG=$(git log -1 --pretty=%s)

if [[ "$COMMIT_MSG" == chore:\ bump\ version\ to* ]]; then
  echo "✓ Production release commit detected — proceeding with build"
  exit 1
fi

echo "⏭ Production deploy skipped (not a release commit)"
exit 0
