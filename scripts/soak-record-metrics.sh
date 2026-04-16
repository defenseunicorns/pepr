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
cf=$(grep -v "^#" "$AUDITOR_LOG" | grep "watch_controller_failures_total" | awk '{print $NF}' | tail -1) || true

# pepr_cache_miss: gauge per time window e.g. pepr_cache_miss{window="..."} 16 — sum all windows
cm=$(grep -v "^#" "$INFORMER_LOG" | grep "pepr_cache_miss" | awk '{sum += $NF} END {print sum+0}') || true

# pepr_resync_failure_count: label holds failure count e.g. {count="0"} 1 — sum non-zero count labels
rf=$(grep -v "^#" "$INFORMER_LOG" | grep "pepr_resync_failure_count" | sed 's/.*count="\([^"]*\)".*/\1/' | awk '$1+0 > 0 {sum += $1+0} END {print sum+0}') || true

cf="${cf:-0}"; cm="${cm:-0}"; rf="${rf:-0}"

printf "%s,%s,%s,%s,%s\n" "$ITERATION" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$cf" "$cm" "$rf" >> "$METRICS_CSV"
