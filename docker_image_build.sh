#!/bin/bash

UNICORN_MODE=false
IMAGE_NAME="my-app"

while [[ $# -gt 0 ]]; do
    case "$1" in
        unicorn)
            UNICORN_MODE=true
            ;;
        -t|--tag)
            shift
            IMAGE_NAME="$1"
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: ./build.sh [unicorn] [-t IMAGE_NAME]"
            exit 1
            ;;
    esac
    shift
done

BASE_IMAGE="docker.io/library/node@sha256:a182b9b37154a3e11e5c1d15145470ceb22069646d0b7390de226da2548aa2a7"
UNICORN_IMAGE="cgr.dev/du-uds-defenseunicorns/node:22.14.0@sha256:18160bed0e77c8300b99a8d1af8cc997280e189e590b55b5ff94893bd398a1e6"

BASE_RUNTIME_IMAGE="gcr.io/distroless/nodejs22-debian12:nonroot@sha256:894873fc72ea5731e38cf3cfa75a6a3b1985a9330e46bb4d81162e6a184f212e"
UNICORN_RUNTIME_IMAGE="cgr.dev/du-uds-defenseunicorns/node:22.14.0-slim@sha256:95ce4c850fd71a7fe53d9cbaf7f9db318bba9c0ade54717078d9e60c317b5496"

BUILD_IMAGE="$BASE_IMAGE"
RUNTIME_IMAGE="$BASE_RUNTIME_IMAGE"
MODE="DEFAULT"

if [ "$UNICORN_MODE" = true ]; then
    BUILD_IMAGE=$UNICORN_IMAGE
    RUNTIME_IMAGE=$UNICORN_RUNTIME_IMAGE
    MODE="UNICORN"
fi

echo "🚀 Building in $MODE mode..."
echo "🛠️  Using BUILD_IMAGE name: $BUILD_IMAGE"
echo "🛠️  Using RUNTIME_IMAGE name: $RUNTIME_IMAGE"kkj

echo "🛠️  Using image name: $IMAGE_NAME"

docker build \
    --build-arg BASE_IMAGE=$BUILD_IMAGE \
    --build-arg BASE_RUNTIME_IMAGE="$RUNTIME_IMAGE" \
    -t "$IMAGE_NAME" .

exit $?
