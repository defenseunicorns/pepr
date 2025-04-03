#!/bin/bash

# Read build arguments into an array using portable syntax
BUILD_ARGS=()
while IFS= read -r arg; do
    BUILD_ARGS+=("$arg")
done < <(node scripts/read-unicorn-build-args.mjs)

docker buildx build --push --platform linux/arm64/v8,linux/amd64 --tag ghcr.io/defenseunicorns/pepr/controller:v"$1" .
docker buildx build --push --platform linux/arm64/v8,linux/amd64 "${BUILD_ARGS[@]}" --tag ghcr.io/defenseunicorns/pepr/private/controller:v"$1" .