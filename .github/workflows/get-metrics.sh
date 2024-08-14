#!/bin/bash

# watch-auditor ns is already created
kubectl run metrics-collector -n watch-auditor --image=nginx --restart=Never

# wait for deployments to be ready
# we sleep instead of kubectl --wait=for
# because deployments have not been deployed yet
sleep 180

# Loop to run commands every 5 minutes
while true; do
  
  # Save metrics to logs folder and report
  kubectl exec -it metrics-collector -n watch-auditor -- curl watch-auditor:8080/metrics >> logs/auditor-log.txt
  cat logs/auditor-log.txt
  kubectl exec -it metrics-collector -n watch-auditor -- curl -k https://pepr-soak-ci-watcher.pepr-system.svc.cluster.local/metrics >> logs/informer-log.txt
  cat logs/informer-log.txt
  sleep 180
done
