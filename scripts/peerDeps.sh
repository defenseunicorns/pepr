#!/bin/bash

echo "Reviewing peerDependencies:"
echo ""
PEER_DEPS=$(jq -r '.peerDependencies | keys[]' package.json)

for dependency in $PEER_DEPS; do
  echo "    \"$dependency\": \"$(npm show "$dependency" version)\","
done

echo ""
echo "INFO - Manually copy these values to update the listed versions in package.json's peerDependencies."