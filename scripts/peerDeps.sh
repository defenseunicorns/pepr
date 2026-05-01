#!/bin/bash
#
# Thin wrapper around scripts/update-peer-deps.mjs that pretty-prints pending
# peerDependency bumps for human inspection. The MJS script is the canonical
# implementation and is also invoked directly by the peer-deps-update workflow.

set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT="$(node "${SCRIPT_DIR}/update-peer-deps.mjs" --report)"

echo "Reviewing peerDependencies:"
echo ""

MINOR=$(echo "${REPORT}" | jq -r '.minor | to_entries[] | "    \(.key): \(.value.from) -> \(.value.to)"')
MAJOR=$(echo "${REPORT}" | jq -r '.major[] | "    \(.name): \(.from) -> \(.to)"')

if [ -n "${MINOR}" ]; then
  echo "  Minor / patch bumps:"
  echo "${MINOR}"
  echo ""
fi

if [ -n "${MAJOR}" ]; then
  echo "  Major bumps (require human review):"
  echo "${MAJOR}"
  echo ""
fi

if [ -z "${MINOR}" ] && [ -z "${MAJOR}" ]; then
  echo "  All peerDependencies are at their latest published versions."
  echo ""
fi

echo "INFO - Peer-dep bumps are normally landed by the peer-deps-update GitHub Actions workflow."
echo "INFO - To apply locally: node ${SCRIPT_DIR}/update-peer-deps.mjs --write minor"
echo "INFO -                   node ${SCRIPT_DIR}/update-peer-deps.mjs --write major --pkg <name>"
