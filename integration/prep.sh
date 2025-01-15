#!/bin/sh
# This script makes a version of the npm cache for local use to avoid installing test artifacts into the global npm cache.
# This isn't an issue in CI where environments are ephemeral, but is useful for local testing.
ME="$(readlink -f "$0")"
HERE="$(dirname "$ME")"
ROOT="$(dirname "$HERE")"

export NPM_CONFIG_CACHE="${HERE}/testroot/.npm"
mkdir --parents "$NPM_CONFIG_CACHE"

npm run build
npx --yes file://${ROOT}/pepr-0.0.0-development.tgz