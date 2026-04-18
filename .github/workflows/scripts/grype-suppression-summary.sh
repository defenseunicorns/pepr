#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: 2023-Present The Pepr Authors
#
# Writes a GitHub Actions workflow summary for the grype suppression audit.
#
# Expected environment variables:
#   STALE_COUNT   - number of stale suppressions found
#   STALE_LIST    - newline-separated list of stale IDs

set -euo pipefail

{
  echo "# Grype Suppression Audit"
  echo ""
  echo "| | |"
  echo "|---|---|"
  echo "| **Image scanned** | \`pepr:dev\` |"
  echo "| **Stale suppressions found** | ${STALE_COUNT:-0} |"
  echo ""

  if [ "${STALE_COUNT:-0}" -eq 0 ]; then
    echo "## All suppressions are still active"
    echo ""
    echo "No changes to \`.grype.yaml\` are needed."
  else
    echo "## PR created or updated"
    echo ""
    echo "The following suppressions were removed from \`.grype.yaml\`. A PR has been opened or updated for review."
    echo ""
    echo "### Removed suppressions"
    echo "- ${STALE_LIST//$'\n'/$'\n'- }"
    echo ""
  fi
} >> "$GITHUB_STEP_SUMMARY"
