#!/bin/bash
# This script makes a version of the npm cache for local use to avoid installing test artifacts into the global npm cache.
# This isn't an issue in CI where environments are ephemeral, but is useful for local testing.

set -euo pipefail

ME="$(readlink -f "$0")"
HERE="$(dirname "$ME")"
ROOT="$(dirname "$HERE")"

export NPM_CONFIG_CACHE="${HERE}/testroot/.npm"
# ubuntu supports "--parents" long opt but macOS does not, so using "-p" short opt
mkdir -p "$NPM_CONFIG_CACHE"

npm run build
npx --yes "file://${ROOT}/pepr-0.0.0-development.tgz"