---
name: Watch Failure
about: Report a watch failure
title: ''
labels: 'possible-bug, uds'
assignees: ''
---

### Environment
Kubernetes Distro: (e.g., AKS, EKS, GKE, OpenShift, etc.)  
Cloud Provider (if applicable): (e.g., AWS, Azure, GCP)  
Kubernetes Version: (e.g., 1.31)  
Pepr Version: (`kubectl get po -n pepr-system -ojsonpath='{.items[0].spec.containers[0].image}'`)  

### Description of the Failure

Provide a detailed explanation of the issue, including any observed symptoms or behaviors that indicate a watch failure.


### Steps to Reproduce

List the steps required to reproduce the issue, including any relevant configuration details or operations performed.

### Debugging Info

- Has this happened before? (Yes/No, provide details if Yes)

- How long had pods been running? (e.g., 1 hour, 1 day, etc.)

Attach Metrics

```bash
SERVICE_NAME=$(kubectl get svc -n pepr-system -l pepr.dev/controller=watcher -ojsonpath='{.items[0].metadata.name}')

kubectl run curler --image=nginx:alpine --rm -it --restart=Never -n pepr-system --labels=zarf.dev/agent=ignore -- curl -k https://$SERVICE_NAME/metrics > metrics.txt
```

Attach Admission Logs

```bash
DEPLOYMENT_NAME=$(kubectl get deploy -n pepr-system -l pepr.dev/controller=admission -ojsonpath='{.items[0].metadata.name}')

kubectl logs deploy/$DEPLOYMENT_NAME -n pepr-system > admission.logs
```

Attach Watcher Logs

```bash
DEPLOYMENT_NAME=$(kubectl get deploy -n pepr-system -l pepr.dev/controller=watcher -ojsonpath='{.items[0].metadata.name}')

kubectl logs deploy/$DEPLOYMENT_NAME -n pepr-system > watcher.logs
```
