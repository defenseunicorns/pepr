# Metrics Endpoints

The `/metrics` endpoint provides metrics for the application that are collected via the `MetricsCollector` class. It uses the `prom-client` library and performance hooks from Node.js to gather and expose the metrics data in a format that can be scraped by Prometheus.

## Metrics Exposed

The `MetricsCollector` exposes the following metrics:

- `pepr_errors`: A counter that increments when an error event occurs in the application.
- `pepr_alerts`: A counter that increments when an alert event is triggered in the application.
- `pepr_mutate`: A summary that provides the observed durations of mutation events in the application.
- `pepr_validate`: A summary that provides the observed durations of validation events in the application.
- `pepr_cache_miss`: A gauge that provides the number of cache misses per window.
- `pepr_resync_failure_count`: A gauge that provides the number of unsuccessful attempts at receiving an event within the last seen event limit before re-establishing a new connection.

## Environment Variables

| `PEPR_MAX_CACHE_MISS_WINDOWS` | Maximum number windows to emit `pepr_cache_miss` metrics for  | default: `Undefined`  |

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

  # HELP pepr_mutate Mutation operation summary
  # TYPE pepr_mutate summary
  pepr_mutate{quantile="0.01"} 100.60707900021225
  pepr_mutate{quantile="0.05"} 100.60707900021225
  pepr_mutate{quantile="0.5"} 100.60707900021225
  pepr_mutate{quantile="0.9"} 100.60707900021225
  pepr_mutate{quantile="0.95"} 100.60707900021225
  pepr_mutate{quantile="0.99"} 100.60707900021225
  pepr_mutate{quantile="0.999"} 100.60707900021225
  pepr_mutate_sum 100.60707900021225
  pepr_mutate_count 1

  # HELP pepr_validate Validation operation summary
  # TYPE pepr_validate summary
  pepr_validate{quantile="0.01"} 201.19413900002837
  pepr_validate{quantile="0.05"} 201.19413900002837
  pepr_validate{quantile="0.5"} 201.2137690000236
  pepr_validate{quantile="0.9"} 201.23339900001884
  pepr_validate{quantile="0.95"} 201.23339900001884
  pepr_validate{quantile="0.99"} 201.23339900001884
  pepr_validate{quantile="0.999"} 201.23339900001884
  pepr_validate_sum 402.4275380000472
  pepr_validate_count 2

  # HELP pepr_cache_miss Number of cache misses per window
  # TYPE pepr_cache_miss gauge
  pepr_cache_miss{window="2024-07-25T11:54:33.897Z"} 18
  pepr_cache_miss{window="2024-07-25T12:24:34.592Z"} 0
  pepr_cache_miss{window="2024-07-25T13:14:33.450Z"} 22
  pepr_cache_miss{window="2024-07-25T13:44:34.234Z"} 19
  pepr_cache_miss{window="2024-07-25T14:14:34.961Z"} 0

  # HELP pepr_resync_failure_count Number of retries per count
  # TYPE pepr_resync_failure_count gauge
  pepr_resync_failure_count{count="0"} 5
  pepr_resync_failure_count{count="1"} 4
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
