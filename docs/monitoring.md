# Monitoring

In order for an application to be integrated with the monitoring stack within BigBang the following things need to occur


1. Identify the pods that have metrics endpoints via:
    1. When Istio is not enabled as well (see [here](https://istio.io/latest/docs/ops/integrations/prometheus/#option-1-metrics-merging) for how istio merges metrics), this can be done with the Prometheus annotations defined below:

        `proetheus.io/scrape` <- Set to true

        `prometheus.io/schema` <- either http(default) or https

        `prometheus.io/path` <- the path that schould be scraped

        `prometheus.io/port` <-- The port to scrape
    1. This can be done with `ServiceMonitors`, `PodMonitors`
1. Create a NetworkPolicy that allows communication from the Prometheus Pods in the Monitoring namespace to talk to the pods with metrics


## Implementation

Proposed implementation, to start, is to create Kyverno policies to create a `NetworkPolicies` for each:
    
1. pod with the appropriate annotation
2. ServiceMonitor
3. PodMonitor 

When Istio is enabled, will also need additional considerations for [mTLS settings](https://docs-bigbang.dso.mil/latest/packages/monitoring/docs/istio-mtls-metrics/)
