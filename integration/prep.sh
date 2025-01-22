#!/bin/sh

set -euo pipefail

ME="$(readlink -f "$0")"
HERE="$(dirname "$ME")"
ROOT="$(dirname "$HERE")"

export NPM_CONFIG_CACHE="${HERE}/testroot/.npm"
mkdir -p "$NPM_CONFIG_CACHE"

npm run build
npx --yes file://${ROOT}/pepr-0.0.0-development.tgz