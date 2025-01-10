#!/bin/sh
ME="$(readlink -f "$0")"
HERE="$(dirname "$ME")"
ROOT="$(dirname "$HERE")"

export NPM_CONFIG_CACHE="${HERE}/testroot/.npm"
mkdir --parents "$NPM_CONFIG_CACHE"

npm run build
npx --yes file://${ROOT}/pepr-0.0.0-development.tgz