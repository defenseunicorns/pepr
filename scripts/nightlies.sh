#!/bin/bash

# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: 2023-Present The Pepr Authors

# Script to build and publish nightly versions of Pepr Controller and Pepr CLI.

set -e
npm install -g npm

LATEST_VERSION=$(npx --yes pepr@latest --version 2>/dev/null)
RAW_NIGHTLY_VERSION=$(npx --yes pepr@nightly --version 2>/dev/null || echo "none")

if [[ "$RAW_NIGHTLY_VERSION" == "none" ]]; then
    echo "No nightly version found. Setting NIGHTLY_VERSION=0."
    NIGHTLY_VERSION=0
else
    NIGHTLY_VERSION_PART=$(echo "$RAW_NIGHTLY_VERSION" | grep -oE "nightly\.([0-9]+)" | cut -d. -f2)

    BASE_NIGHTLY_VERSION=${RAW_NIGHTLY_VERSION%-nightly*}
    if [[ "$LATEST_VERSION" > "$BASE_NIGHTLY_VERSION" ]]; then
        echo "Nightly version is less than the latest version. Resetting NIGHTLY_VERSION to 0."
        NIGHTLY_VERSION=0
    else
        NIGHTLY_VERSION=$((NIGHTLY_VERSION_PART + 1))
        echo "Incrementing NIGHTLY_VERSION to $NIGHTLY_VERSION."
    fi
fi

FULL_VERSION="${LATEST_VERSION}-nightly.${NIGHTLY_VERSION}"

echo "FULL_VERSION=$FULL_VERSION" >> "$GITHUB_ENV"

npm version --no-git-tag-version "$FULL_VERSION"

./scripts/push-controller-images.sh "$FULL_VERSION"

npm install 
npm run build

npm publish --tag "nightly"

# UDS Registry
oras push registry.defenseunicorns.com/pepr-dev/npm/pepr:"$FULL_VERSION" \
    --artifact-type application/vnd.pepr.module.layer.v1 pepr-"$FULL_VERSION".tgz
