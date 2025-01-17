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
Pepr Version: (e.g., 0.34.3)  

### Description of the Failure

Provide a detailed explanation of the issue, including any observed symptoms or behaviors that indicate a watch failure.


### Steps to Reproduce

List the steps required to reproduce the issue, including any relevant configuration details or operations performed.

### Debugging Info

- Has this happened before? (Yes/No, provide details if Yes)

Attach Metrics

```bash
kubectl run curler --image=nginx:alpine --rm -it --restart=Never -n pepr-system --labels=zarf.dev/agent=ignore -- curl -k https://$(kubectl get deploy -n pepr-system -l pepr.dev/controller=watcher -ojsonpath='{.items[0].metadata.name}')/metrics > metrics.txt
```

Attach Admission Logs

```bash
kubectl logs deploy/$(kubectl get deploy -n pepr-system -l pepr.dev/controller=admission -ojsonpath='{.items[0].metadata.name}') -n pepr-system > admission.logs
```

Attach Watcher Logs

```bash
kubectl logs deploy/$(kubectl get deploy -n pepr-system -l pepr.dev/controller=watcher -ojsonpath='{.items[0].metadata.name}') -n pepr-system > watcher.logs
```

