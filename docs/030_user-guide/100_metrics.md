# Metrics Endpoints

The `/metrics` endpoint provides metrics for the application that are collected via the `MetricsCollector` class. It uses the `prom-client` library and performance hooks from Node.js to gather and expose the metrics data in a format that can be scraped by Prometheus.

## Metrics Exposed

The `MetricsCollector` exposes the following metrics:

- `pepr_errors`: A counter that increments when an error event occurs in the application.
- `pepr_alerts`: A counter that increments when an alert event is triggered in the application.
- `pepr_Mutate`: A summary that provides the observed durations of mutation events in the application.
- `pepr_Validate`: A summary that provides the observed durations of validation events in the application.

## API Details

**Method:** GET

**URL:** `/metrics`

**Response Type:** text/plain

**Status Codes:**

- 200 OK: On success, returns the current metrics from the application.

**Response Body:**
The response body is a plain text representation of the metrics data, according to the Prometheus exposition formats. It includes the metrics mentioned above.

## Examples

### Request

```plaintext
GET /metrics
```

### Response

```plaintext
  `# HELP pepr_errors Mutation/Validate errors encountered
  # TYPE pepr_errors counter
  pepr_errors 5

  # HELP pepr_alerts Mutation/Validate bad api token received
  # TYPE pepr_alerts counter
  pepr_alerts 10

  # HELP pepr_Mutate Mutation operation summary
  # TYPE pepr_Mutate summary
  pepr_Mutate{quantile="0.01"} 100.60707900021225
  pepr_Mutate{quantile="0.05"} 100.60707900021225
  pepr_Mutate{quantile="0.5"} 100.60707900021225
  pepr_Mutate{quantile="0.9"} 100.60707900021225
  pepr_Mutate{quantile="0.95"} 100.60707900021225
  pepr_Mutate{quantile="0.99"} 100.60707900021225
  pepr_Mutate{quantile="0.999"} 100.60707900021225
  pepr_Mutate_sum 100.60707900021225
  pepr_Mutate_count 1

  # HELP pepr_Validate Validation operation summary
  # TYPE pepr_Validate summary
  pepr_Validate{quantile="0.01"} 201.19413900002837
  pepr_Validate{quantile="0.05"} 201.19413900002837
  pepr_Validate{quantile="0.5"} 201.2137690000236
  pepr_Validate{quantile="0.9"} 201.23339900001884
  pepr_Validate{quantile="0.95"} 201.23339900001884
  pepr_Validate{quantile="0.99"} 201.23339900001884
  pepr_Validate{quantile="0.999"} 201.23339900001884
  pepr_Validate_sum 402.4275380000472
  pepr_Validate_count 2
```

## Prometheus Operator

If using the Prometheus Operator, the following `ServiceMonitor` example manifests can be used to scrape the `/metrics` endpoint for the `admission` and `watcher` controllers.

```yaml
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
```
