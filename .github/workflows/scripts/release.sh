#!/bin/bash

npm install -g npm

npm run set:version

./scripts/push-controller-images.sh "$1"