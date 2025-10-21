#!/bin/bash

set -e 
npm install --global npm

./scripts/push-controller-images.sh "$1" # Passthrough version string, validation in push-controller-images.sh
