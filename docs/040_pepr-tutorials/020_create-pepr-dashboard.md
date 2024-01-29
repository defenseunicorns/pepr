# Tutorial - Create a Pepr Dashboard

## Introduction

This tutorial will walk you through the process of creating a dashboard to display your Pepr metrics. This dashboard will present data such as the number of validation requests processed, the number of mutation requests that were allowed, the number of errors that were processed, the number of alerts that were processed, the status of the Pepr pods, and the scrape duration of the Pepr pods. This dashboard will be created using [Grafana](https://grafana.com/). The dashboard will display data from [Prometheus](https://prometheus.io/), which is a monitoring system that Pepr uses to collect metrics.

This tutorial is not intended for production, but instead is intended to show how to quickly scrape Pepr metrics. The [kube prometheus stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack) provides a more production suitable way of deploying Prometheus in prod.

An example of what the dashboard will look like is shown below:

![Pepr Dashboard](../../dashboards/pepr-dashboard-screenshot.png)

***Note:*** *The dashboard shown above is an example of what the dashboard will look like. The dashboard will be populated with data from your Pepr instance.*

## Prerequisites

1. Have a Pepr module created and deployed. If you do not have a Pepr module created and deployed, follow the [Create a Pepr Module](010_create-pepr-module.md) tutorial.
2. Have a local Kubernetes cluster running. If you do not have a local Kubernetes cluster running, follow the [Create a Pepr Module](010_create-pepr-module.md) tutorial.

## Steps

1. **Create a Prometheus deployment**:

    **Option 1**:

    To create a Prometheus deployment, run the following command:

    ```bash
    kubectl apply -f https://raw.githubusercontent.com/defenseunicorns/pepr/master/dashboards/prometheus.yaml
    ```

    This will create a Prometheus deployment in the `pepr-dashboard` namespace using the deployment in the [prometheus.yaml](../../dashboards/prometheus.yaml) file. This deployment will create a Prometheus pod, a Prometheus service, and a Prometheus configmap. The Prometheus pod will be exposed on port 9090.

    **Option 2**:

    1. Deploy Prometheus operator controller manager

    ```plaintext
    kubectl create -f https://raw.githubusercontent.com/prometheus-operator/prometheus-operator/main/bundle.yaml
    ```

    2. Create an instance of Prometheus

    ```yaml
    kubectl create -f -<<EOF
    kind: Prometheus
    apiVersion: monitoring.coreos.com/v1
    metadata:
    name: k8s
    namespace: default
    spec:
    serviceMonitorSelector: {}
    serviceMonitorNamespaceSelector: {}
    logLevel: debug
    logFormat: json
    replicas: 1
    image: quay.io/prometheus/prometheus:v2.35.0
    serviceAccountName: prometheus-operator
    EOF
    ```

    3. By default, the prometheus service account does not have sufficient permissions to `get/list/watch` the necessary Kubernetes resources. Create a clusterRole to allow scraping:

    ```yaml
    kubectl apply -f -<<EOF
    apiVersion: rbac.authorization.k8s.io/v1
    kind: ClusterRole
    metadata:
    creationTimestamp: null
    name: scrape-resources
    rules:
    - apiGroups:
    - ""
    resources:
    - pods
    - pods/status
    - endpoints
    - services
    verbs:
    - list
    - get
    - watch
    EOF
    ```

    4. Assign the clusterRole to the Prometheus `serviceAccount`:

    ```plaintext
    kubectl create clusterrolebinding scrape-binding --clusterrole=scrape-resources --serviceaccount=default:prometheus-operator
    ```

    5. Create a ServiceMonitor to scrape the `admission` and `watcher` controller services:

    ```yaml
    kubectl create -f -<<EOF
    apiVersion: monitoring.coreos.com/v1
    kind: ServiceMonitor
    metadata:
    name: admission
    spec:
    selector:
        matchLabels:
        pepr.dev/controller: admission
    namespaceSelector:
        matchNames:
        - pepr-system
    endpoints:
    - targetPort: 3000
        scheme: https
        tlsConfig:
        insecureSkipVerify: true
    ---
    apiVersion: monitoring.coreos.com/v1
    kind: ServiceMonitor
    metadata:
    name: watcher
    namespace: default
    spec:
    selector:
        matchLabels:
        pepr.dev/controller: watcher
    namespaceSelector:
        matchNames:
        - pepr-system
    endpoints:
    - targetPort: 3000
        scheme: https
        tlsConfig:
        insecureSkipVerify: true
    EOF
    ```

    6. Port-forward to the Prometheus service and check out [targets](http://127.0.0.1:9090/targets).

    ```plaintext
    kubectl port-forward svc/prometheus-operated 9090
    ```

2. **Create a Grafana deployment**:

    **Option 1**:

    To create a Grafana deployment, run the following command:

    ```bash
    kubectl apply -f https://raw.githubusercontent.com/defenseunicorns/pepr/main/dashboards/grafana.yaml
    ```

    This will create a Grafana deployment in the `pepr-dashboard` namespace using the deployment in the [grafana.yaml](../../dashboards/grafana.yaml) file. This deployment will create a Grafana pod, a Grafana service, and a Grafana configmap. The Grafana pod will be exposed on port 3000.

    **Option 2**:

    1. Deploy the Grafana helm chart

    ```bash
    kubectl create ns grafana
    helm install grafana -n grafana oci://registry-1.docker.io/bitnamicharts/grafana-operator
    ```

    2. Create an instance of `Grafana`

    ```yaml
    kubectl create -f -<<EOF
    apiVersion: grafana.integreatly.org/v1beta1
    kind: Grafana
    metadata:
    name: grafana
    namespace: grafana
    labels:
        dashboards: "grafana"
    spec:
    config:
        log:
            mode: "console"
        security:
            admin_user: root
            admin_password: secret
    EOF
    ```

    3. Setup Port Forwarding

    First, confirm that your grafana-service is running on port 3000:

    ```
    k get svc -n grafana
    ```

    You should see something similar to:

    ```
    grafana-grafana-operator-grafana-service   ClusterIP   10.43.168.97    <none>        3000/TCP   12m
    grafana-service                            ClusterIP   10.43.219.108   <none>        3000/TCP   11m
    ```

    You can now set up the port-forwarding so that Grafana can use the Prometheus data as a datasource:

    ```
    k port-forward svc/grafana-service 3000 --namespace grafana
    ```

3. **Create a Grafana dashboard**:

    **Option 1**:

    To create a Grafana dashboard, run the following command:

    ```bash
    kubectl apply -f https://raw.githubusercontent.com/defenseunicorns/pepr/main/dashboards/pepr-dashboard.yaml
    ```

    This will create a Grafana dashboard in the `pepr-dashboard` namespace. This dashboard will be named `Pepr Dashboard`. This dashboard will display data from Prometheus. The dashboard will display data such as the number of validation requests processed, the number of mutation requests that were allowed, the number of errors that were processed, the number of alerts that were processed, the status of the Pepr pods, and the scrape duration of the Pepr pods.

    **Option 2**:

    Import the dashboard from the [pepr-dashboard.json](../../dashboards/pepr-dashbord.json) file.

    To import the dashboard, follow the steps below:

    1. Navigate to the Grafana dashboard at `http://localhost:3000`.
    2. Click on the Dashboard icon on the left side of the screen.
    3. Click on `+ Import`.
    4. Click on `Upload JSON File`.
    5. Select the [Pepr Dashboard](../../dashboards/pepr-dashboard.json) file.
    6. Click on `Load`.
    7. Select the `Prometheus` data source.
    8. Click on `Import`.
    9. The dashboard will now be imported and displayed.
    10. Click on `Save Dashboard`.
    11. The dashboard will now be saved.

## Summary

This tutorial demonstrated how to use Prometheus and Grafana to display metrics from your Pepr instance. If you have questions about Pepr metrics or dashboards, please reach out to us on [Slack](https://kubernetes.slack.com/archives/C06DGH40UCB) or [GitHub Issues](https://github.com/defenseunicorns/pepr/issues)
