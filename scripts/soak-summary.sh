#!/bin/bash

# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: 2024-Present The Pepr Authors

# Reads soak test metrics and writes a Markdown summary to $GITHUB_STEP_SUMMARY.
#
# Usage: soak-summary.sh <metrics-csv> <informer-log> <failure-reason>

set -uo pipefail

METRICS_CSV="${1:?metrics csv path required}"
INFORMER_LOG="${2:?informer log path required}"
FAILURE_REASON="${3:?failure reason path required}"

if [ ! -f "$METRICS_CSV" ] || [ "$(wc -l < "$METRICS_CSV")" -lt 2 ]; then
  echo "## Soak Test Results" >> "$GITHUB_STEP_SUMMARY"
  echo "No metrics collected." >> "$GITHUB_STEP_SUMMARY"
  exit 0
fi

final=$(tail -1 "$METRICS_CSV")
iters=$(echo "$final" | cut -d',' -f1)
final_ctrl_failures=$(echo "$final" | cut -d',' -f3)
final_cache_misses=$(echo "$final" | cut -d',' -f4)
final_resync_failures=$(echo "$final" | cut -d',' -f5)

ctrl_failures_status=$([ "${final_ctrl_failures}" = "0" ] && echo "✅" || echo "❌")
resync_failures_status=$([ "${final_resync_failures}" = "0" ] && echo "✅" || echo "❌")

# cache miss: split into startup (first window) and mid-run (all other windows)
startup_misses=$(grep x-v "^#" "$INFORMER_LOG" | grep "pepr_cache_miss" | head -1 | awk '{print $NF}') || true
midrun_misses=$(grep -v "^#" "$INFORMER_LOG" | grep "pepr_cache_miss" | tail -n +2 | awk '{sum += $NF} END {print sum+0}') || true
startup_misses="${startup_misses:-0}"
midrun_misses="${midrun_misses:-0}"

if [ "${final_cache_misses}" = "0" ]; then
  cache_misses_display="0"
else
  cache_misses_display="${final_cache_misses} total (${startup_misses} startup, ${midrun_misses} mid-run)"
fi
cache_misses_status=$([ "${midrun_misses}" = "0" ] && echo "✅" || echo "⚠️")

# resync: total resyncs = sum of all gauge values across resync_failure_count lines
resync_total=$(grep -v "^#" "$INFORMER_LOG" | grep "pepr_resync_failure_count" | awk '{sum += $NF} END {print sum+0}') || true
resync_total="${resync_total:-0}"
resync_failures_display="${final_resync_failures} failures across ${resync_total} resyncs"

{
  echo "## Soak Test Results"
  echo ""
  echo "| Metric | Value | Status |"
  echo "|--------|-------|--------|"
  echo "| \`watch_controller_failures_total\` | ${final_ctrl_failures} | ${ctrl_failures_status} |"
  echo "| \`pepr_cache_miss\` | ${cache_misses_display} | ${cache_misses_status} |"
  echo "| \`pepr_resync_failure_count\` | ${resync_failures_display} | ${resync_failures_status} |"
  echo ""
  echo "**Iterations completed:** ${iters} / 70 | **Duration:** ~$((iters * 5)) minutes"
  echo ""
  if [ -f "${FAILURE_REASON}" ]; then
    echo "### ❌ Failure Reason"
    cat "${FAILURE_REASON}"
  else
    echo "### ✅ Test Passed"
  fi
} >> "$GITHUB_STEP_SUMMARY"
