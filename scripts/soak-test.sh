#!/bin/bash

# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: 2024-Present The Pepr Authors

# Runs the soak test loop: collects metrics every 5 minutes and checks pod stability every 10 minutes.
# Produces logs/ artifacts consumed by soak-summary.sh.
#
# Usage: soak-test.sh

set -uo pipefail

LOGS_DIR="logs"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$LOGS_DIR"
touch "$LOGS_DIR/auditor-log.txt"
touch "$LOGS_DIR/informer-log.txt"
touch "$LOGS_DIR/watch-logs.txt"
echo "iteration,timestamp,watch_controller_failures_delta,pepr_cache_miss_delta,pepr_resync_failure_count" > "$LOGS_DIR/metrics.csv"

# Initialize the map to store pod counts
declare -A pod_map

update_pod_map() {
  for pod in $(kubectl get pods -n pepr-demo -o jsonpath='{.items[*].metadata.name}'); do
    pod_map[$pod]=$(( ${pod_map[$pod]:-0} + 1 ))
  done
}

collect_metrics() {
  kubectl exec metrics-collector -n watch-auditor -- curl watch-auditor:8080/metrics | grep watch_controller_failures_total > "$LOGS_DIR/auditor-log.txt"
  kubectl exec metrics-collector -n watch-auditor -- curl -k https://pepr-soak-ci-watcher.pepr-system.svc.cluster.local/metrics | grep -E "pepr_cache_miss|pepr_resync_failure_count" > "$LOGS_DIR/informer-log.txt"
  kubectl logs deploy/pepr-soak-ci-watcher -n pepr-system > "$LOGS_DIR/watch-logs.txt"
}

update_pod_map

# Start collecting metrics every 5 minutes and checking pod counts every 10 minutes
for i in {1..70}; do  # 70 iterations cover 350 minutes (5 hours and 50 minutes)
  collect_metrics
  cat "$LOGS_DIR/informer-log.txt"
  cat "$LOGS_DIR/auditor-log.txt"

  bash "$SCRIPT_DIR/soak-record-metrics.sh" "$i" "$LOGS_DIR/auditor-log.txt" "$LOGS_DIR/informer-log.txt" "$LOGS_DIR/metrics.csv"

  if [ $((i % 2)) -eq 0 ]; then  # Every 10 minutes
    update_pod_map

    kubectl get pods -n pepr-demo
    kubectl top po -n pepr-system
    kubectl get po -n pepr-system

    # Verify that no pod's count exceeds 1
    for pod in "${!pod_map[@]}"; do
      echo "$pod: ${pod_map[$pod]}"
      if [ "${pod_map[$pod]}" -gt 1 ]; then
        echo "Test failed: Pod $pod has count ${pod_map[$pod]}"
        echo "Pod $pod was recreated (seen ${pod_map[$pod]} times) at iteration ${i} (~$((i * 5)) minutes into the run." > "$LOGS_DIR/failure-reason.txt"
        kubectl logs deploy/pepr-soak-ci-watcher -n pepr-system
        exit 1
      fi
    done
  fi

  sleep 300s  # Sleep for 5 minutes before the next iteration
done

echo "Soak test passed successfully!"
