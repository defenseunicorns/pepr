# `/metrics` Endpoint Documentation

The `/metrics` endpoint provides metrics for the application that are collected via the `MetricsCollector` class. It uses the `prom-client` library and performance hooks from Node.js to gather and expose the metrics data in a format that can be scraped by Prometheus.

## Metrics Exposed

The `MetricsCollector` exposes the following metrics:

- `pepr_errors`: A counter that increments when an error event occurs in the application.
- `pepr_alerts`: A counter that increments when an alert event is triggered in the application.
- `pepr_summary`: A summary that provides the observed durations of events in the application.

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
# HELP pepr_errors error counter
# TYPE pepr_errors counter
pepr_errors 5

# HELP pepr_alerts alerts counter
# TYPE pepr_alerts counter
pepr_alerts 10

# HELP pepr_summary summary
# TYPE pepr_summary summary
pepr_summary{quantile="0.01"} 200
pepr_summary{quantile="0.05"} 220
pepr_summary{quantile="0.5"} 250
pepr_summary{quantile="0.9"} 280
pepr_summary{quantile="0.95"} 300
pepr_summary{quantile="0.99"} 350
pepr_summary{quantile="0.999"} 400
pepr_summary_sum 123456789
pepr_summary_count 500
```