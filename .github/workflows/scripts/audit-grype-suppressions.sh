#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: 2023-Present The Pepr Authors
#
# Audits .grype.yaml for stale CVE suppressions.
# A suppression is stale if grype no longer matches it against the scanned image.
#
# Verification: after removing stale entries, grype is re-run and the count of
# non-suppressed matches must be identical to the count before removal. A mismatch
# means a suppression was incorrectly identified as stale and the script aborts
# without modifying .grype.yaml.
#
# Outputs (written to $GITHUB_OUTPUT):
#   stale_count  - number of stale suppressions found
#   stale_list   - newline-separated list of stale IDs (empty if none)
#   match_count  - number of non-suppressed matches after removal

set -euo pipefail

IMAGE="${IMAGE:-pepr:dev}"
GRYPE_YAML=".grype.yaml"
GRYPE="${GRYPE_CMD:-grype}"

echo "==> Scanning ${IMAGE} with current suppression list..."
SCAN_JSON=$("${GRYPE}" "${IMAGE}" --config "${GRYPE_YAML}" --output json)

# Count non-suppressed matches before removal (baseline for verification)
MATCH_COUNT_BEFORE=$(echo "${SCAN_JSON}" | jq '[.matches // []] | length')
echo "Non-suppressed matches (before): ${MATCH_COUNT_BEFORE}"

# Collect every ID that grype actually matched and then suppressed.
# Check both the primary vulnerability ID and any related vulnerability IDs
# since .grype.yaml entries may reference either form (e.g. CVE vs GHSA alias).
# relatedVulnerabilities is a sibling of vulnerability on each ignoredMatch, not nested under it.
IGNORED_IDS=$(echo "${SCAN_JSON}" | jq -r '
  [
    (.ignoredMatches // [])[] |
    (.vulnerability.id),
    ((.relatedVulnerabilities // [])[] | .id)
  ] | unique | .[]
')

# Parse the suppressed IDs from .grype.yaml
SUPPRESSED_IDS=$(grep -E '^\s*- vulnerability:' "${GRYPE_YAML}" | awk '{print $3}')

# Identify stale entries: present in .grype.yaml but not matched by grype
STALE=()
for id in ${SUPPRESSED_IDS}; do
  if ! echo "${IGNORED_IDS}" | grep -qx "${id}"; then
    STALE+=("${id}")
  fi
done

if [ ${#STALE[@]} -eq 0 ]; then
  echo "No stale suppressions found — nothing to do."
  {
    echo "stale_count=0"
    echo "stale_list="
    echo "match_count=${MATCH_COUNT_BEFORE}"
  } >> "${GITHUB_OUTPUT}"
  exit 0
fi

echo "==> Stale suppressions identified:"
printf '   %s\n' "${STALE[@]}"

# Remove stale entries from .grype.yaml (one pass per entry to avoid collisions)
for id in "${STALE[@]}"; do
  grep -vF "  - vulnerability: ${id}" "${GRYPE_YAML}" > tmp_grype.yaml
  mv tmp_grype.yaml "${GRYPE_YAML}"
done

# Verification: re-scan with the updated suppression list and confirm the count
# of non-suppressed matches is unchanged. A difference means a suppression was
# wrongly classified as stale and was still covering an active vulnerability.
echo "==> Verifying updated suppression list..."
SCAN_JSON_AFTER=$("${GRYPE}" "${IMAGE}" --config "${GRYPE_YAML}" --output json)
MATCH_COUNT_AFTER=$(echo "${SCAN_JSON_AFTER}" | jq '[.matches // []] | length')
echo "Non-suppressed matches (after):  ${MATCH_COUNT_AFTER}"

if [ "${MATCH_COUNT_BEFORE}" != "${MATCH_COUNT_AFTER}" ]; then
  echo ""
  git checkout -- "${GRYPE_YAML}"
  echo ""
  echo "ERROR: Non-suppressed match count changed from ${MATCH_COUNT_BEFORE} to ${MATCH_COUNT_AFTER}."
  echo "One or more suppressions were incorrectly identified as stale."
  echo "Aborting — .grype.yaml has been restored to its original state via git."
  exit 1
fi

echo "==> Verification passed — match count unchanged at ${MATCH_COUNT_AFTER}."

# Write outputs for the workflow
STALE_JOINED=$(printf '%s\n' "${STALE[@]}")
{
  echo "stale_count=${#STALE[@]}"
  printf 'stale_list<<EOF\n%s\nEOF\n' "${STALE_JOINED}"
  echo "match_count=${MATCH_COUNT_AFTER}"
} >> "${GITHUB_OUTPUT}"
