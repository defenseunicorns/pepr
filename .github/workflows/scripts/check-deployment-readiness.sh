#!/bin/bash

set -euo pipefail

check_deployment_readiness() {
  local deployment_name=$1
  local namespace=$2
  local expected_ready_replicas=$3
  local timeout=${4:-300} # Timeout in seconds (default: 5 minutes)
  local interval=${5:-5}  # Interval between checks in seconds
  local elapsed=0

  echo "$(date '+%Y-%m-%d %H:%M:%S') - Checking readiness for deployment '$deployment_name' in namespace '$namespace'..."
  echo "$(date '+%Y-%m-%d %H:%M:%S') - Using timeout: ${timeout}s, interval: ${interval}s"

  while [ "$elapsed" -lt "$timeout" ]; do
    ready_replicas=$(kubectl get deploy "$deployment_name" -n "$namespace" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    ready_replicas=${ready_replicas:-0} # Default to 0 if null
    
    if [ "$ready_replicas" == "$expected_ready_replicas" ]; then
      echo "$(date '+%Y-%m-%d %H:%M:%S') - Deployment '$deployment_name' is ready with $ready_replicas replicas."
      return 0
    fi

    echo "$(date '+%Y-%m-%d %H:%M:%S') - Waiting for deployment '$deployment_name' to be ready. Ready replicas: ${ready_replicas:-0}/${expected_ready_replicas}."
    kubectl get deploy -n "$namespace"
    sleep "$interval"
    elapsed=$((elapsed + interval))
  done

  echo "$(date '+%Y-%m-%d %H:%M:%S') - Timeout reached while waiting for deployment '$deployment_name' to be ready."
  return 1
}

# Define success criteria
expected_pepr_replicas=2
expected_watcher_replicas=1
module_name=${1:-}
namespace=${2:-pepr-system} # Default to 'pepr-system' if null

if [ -z "$module_name" ]; then
  echo "Error: Module name MUST be provided as the first argument."
  exit 1
fi

check_deployment_readiness "$module_name" "$namespace" $expected_pepr_replicas || exit 1 # Check readiness for the first deployment

check_deployment_readiness "$module_name-watcher" "$namespace" $expected_watcher_replicas || exit 1 # Check readiness for the watcher deployment
