#!/bin/bash

# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: 2024-Present The Pepr Authors

# Parses Prometheus metrics from soak test log files and appends a row to the metrics CSV.
#
# Usage: soak-record-metrics.sh <iteration> <auditor-log> <informer-log> <metrics-csv>

set -uo pipefail

ITERATION="${1:?iteration number required}"
AUDITOR_LOG="${2:?auditor log path required}"
INFORMER_LOG="${3:?informer log path required}"
METRICS_CSV="${4:?metrics csv path required}"

# watch_controller_failures_total: simple counter, take the value directly
ctrl_failures=$(grep -v "^#" "$AUDITOR_LOG" | grep "watch_controller_failures_total" | awk '{print $NF}' | tail -1) || true

# pepr_cache_miss: gauge per time window e.g. pepr_cache_miss{window="..."} 16 — sum all windows
cache_misses=$(grep -v "^#" "$INFORMER_LOG" | grep "pepr_cache_miss" | awk '{sum += $NF} END {print sum+0}') || true

# pepr_resync_failure_count: label holds failure count e.g. {count="0"} 1 — sum non-zero count labels
resync_failures=$(grep -v "^#" "$INFORMER_LOG" | grep "pepr_resync_failure_count" | sed 's/.*count="\([^"]*\)".*/\1/' | awk '$1+0 > 0 {sum += $1+0} END {print sum+0}') || true

ctrl_failures="${ctrl_failures:-0}"
cache_misses="${cache_misses:-0}"
resync_failures="${resync_failures:-0}"

# Compute deltas against the previous row so each CSV row shows what changed in this interval
prev_row=$(tail -1 "$METRICS_CSV" 2>/dev/null || true)
if [[ "$prev_row" == iteration,* ]] || [[ -z "$prev_row" ]]; then
  # First data row: no previous values to diff against
  ctrl_failures_delta="$ctrl_failures"
  cache_misses_delta="$cache_misses"
else
  prev_ctrl=$(echo "$prev_row" | cut -d',' -f3)
  prev_cache=$(echo "$prev_row" | cut -d',' -f4)
  ctrl_failures_delta=$(( ctrl_failures - ${prev_ctrl:-0} ))
  cache_misses_delta=$(( cache_misses - ${prev_cache:-0} ))
fi

printf "%s,%s,%s,%s,%s\n" "$ITERATION" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ctrl_failures_delta" "$cache_misses_delta" "$resync_failures" >> "$METRICS_CSV"
