#!/bin/bash

# Copyright 2024 Defense Unicorns
# SPDX-License-Identifier: Apache-2.0

set -e 
set -o pipefail 

if [[ -z "$1" ]]; then
  echo "Usage: $0 <GITHUB_WORKSPACE>"
  exit 1
fi

export GITHUB_WORKSPACE="$1"


# Ensure PEPR environment variable is set
if [[ -z "$PEPR" ]]; then
  echo "Error: PEPR environment variable is not set."
  exit 1
fi

cd "$PEPR"

# Define output image tar paths
PEPR_AMD_TAR="$GITHUB_WORKSPACE/pepr-amd-img.tar"

echo "PEPR_AMD_TAR=${PEPR_AMD_TAR}"

# Build Pepr
npm run build


# Build Docker images
export PEPR_BUILD_VERSION
PEPR_BUILD_VERSION=v$(npx pepr@latest --version)
docker build --build-arg PEPR_BUILD_VERSION="$PEPR_BUILD_VERSION" -t pepr:amd -f Dockerfile.ironbank.amd .

# Save Docker images
docker image save --output "$PEPR_AMD_TAR" pepr:amd

echo "Build complete! Images saved to:"
echo "  - $PEPR_AMD_TAR"
