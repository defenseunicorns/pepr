#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: 2023-Present The Pepr Authors
#
# Writes a GitHub Actions workflow summary for the grype suppression audit.
#
# Usage:
#   grype-suppression-summary.sh --audit-outcome <success|failure|skipped> \
#     [--stale-count <n>] [--stale-list <comma-separated IDs>]

set -euo pipefail

AUDIT_OUTCOME=""
STALE_COUNT=0
STALE_LIST=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --audit-outcome)
      AUDIT_OUTCOME="$2"
      shift 2
      ;;
    --stale-count)
      STALE_COUNT="$2"
      shift 2
      ;;
    --stale-list)
      STALE_LIST="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

{
  echo "# Grype Suppression Audit"
  echo ""

  if [ "${AUDIT_OUTCOME}" != "success" ]; then
    echo "> **Warning**: The audit step did not complete successfully (outcome: ${AUDIT_OUTCOME})."
    echo "> Results below may be incomplete. Check the workflow logs for details."
    echo ""
  fi

  echo "| | |"
  echo "|---|---|"
  echo "| **Image scanned** | \`pepr:dev\` |"
  echo "| **Stale suppressions found** | ${STALE_COUNT} |"
  echo ""

  if [ "${STALE_COUNT}" -eq 0 ]; then
    echo "## All suppressions are still active"
    echo ""
    echo "No changes to \`.grype.yaml\` are needed."
  else
    echo "## PR created or updated"
    echo ""
    echo "The following suppressions were removed from \`.grype.yaml\`. A PR has been opened or updated for review."
    echo ""
    echo "### Removed suppressions"
    # Convert comma-separated list to markdown bullet points
    IFS=',' read -ra IDS <<< "$STALE_LIST"
    for id in "${IDS[@]}"; do
      echo "- ${id}"
    done
    echo ""
  fi
} >> "$GITHUB_STEP_SUMMARY"
