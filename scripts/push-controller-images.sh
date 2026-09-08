#!/bin/bash

# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: 2023-Present The Pepr Authors

# This script builds and pushes Pepr controller images to GHCR
# Usage: ./push-controller-images.sh <version>
# Example: ./push-controller-images.sh 0.12.3 (for releases)
#          ./push-controller-images.sh 0.12.3-nightly.4 (for nightlies)

if [ $# -ne 1 ]; then
    echo "Error: Version parameter is required"
    echo "Usage: $0 <version>"
    echo "Example: $0 0.12.3"
    exit 1
fi

VERSION=$1
# Validate version format (semver with optional -nightly.N suffix)
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-nightly\.[0-9]+)?$ ]]; then
    echo "Error: Invalid version format: $VERSION"
    echo "Version must be in format: X.Y.Z or X.Y.Z-nightly.N"
    echo "Example: 0.12.3 or 0.12.3-nightly.4"
    exit 1
fi

# GHCR
docker buildx build --push --platform linux/arm64/v8,linux/amd64 --tag ghcr.io/defenseunicorns/pepr/controller:v"$VERSION" .
docker buildx build --push --platform linux/arm64/v8,linux/amd64 --file config/Dockerfile --tag ghcr.io/defenseunicorns/pepr/private/controller:v"$VERSION" .

# UDS Registry
docker buildx build --push --platform linux/arm64/v8,linux/amd64 --tag registry.defenseunicorns.com/pepr-dev/controller:v"$VERSION" .
docker buildx build --push --platform linux/arm64/v8,linux/amd64 --file config/Dockerfile --tag registry.defenseunicorns.com/pepr-dev/private/controller:v"$VERSION" .
