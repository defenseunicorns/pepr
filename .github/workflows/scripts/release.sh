#!/bin/bash

set -e 
npm install -g npm

npm run set:version

./scripts/push-controller-images.sh "$1" # Passthrough version string, validation in push-controller-images.sh