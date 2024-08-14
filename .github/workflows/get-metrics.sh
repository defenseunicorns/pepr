#!/bin/bash

# Loop to run commands every 15 minutes
while true; do
  # List all pods (example namespace: your-namespace)
  kubectl get pods -n your-namespace
  
  # Exec into specific pods and get metrics or logs
  kubectl exec -it runner -n watch-auditor -- curl watch-auditor:8080/metrics >> logs/auditor-log.txt
  kubectl exec your-pod-2 -n pepr-system -- curl -k https://localhost:3000/metrics >> logs/informer-log.txt
  
  # Wait for 15 minutes before next iteration
  sleep 900
done
