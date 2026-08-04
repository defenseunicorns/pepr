# Customization

This document outlines how to customize the build output through Helm overrides and `package.json` configurations.

## Redact Store Values from Logs

By default, the store values are displayed in logs, to redact them you can set the `PEPR_STORE_REDACT_VALUES` environment variable to `true` in the `package.json` file or directly on the Watcher or Admission `Deployment`. The default value is `undefined`.

```json
{
  "env": {
    "PEPR_STORE_REDACT_VALUES": "true"
  }
}
```

## Display Node Warnings

You can display warnings in the logs by setting the `PEPR_NODE_WARNINGS` environment variable to `true` in the `package.json` file or directly on the Watcher or Admission `Deployment`. The default value is `undefined`.

```json
{
  "env": {
    "PEPR_NODE_WARNINGS": "true"
  }
}
```

## Customizing Log Format

The log format can be customized by setting the `PINO_TIME_STAMP` environment variable in the `package.json` file or directly on the Watcher or Admission `Deployment`. The default value is a partial JSON timestamp string representation of the time. If set to `iso`, the timestamp is displayed in an ISO format.

**Caution**: attempting to format time in-process will significantly impact logging performance.

```json
{
  "env": {
    "PINO_TIME_STAMP": "iso"
  }
}
```

With ISO:

```json
{"level":30,"time":"2024-05-14T14:26:03.788Z","pid":16,"hostname":"pepr-static-test-7f4d54b6cc-9lxm6","method":"GET","url":"/healthz","status":200,"duration":"1 ms"}
```

Default (without):

```json
{"level":30,"time":"1715696764106","pid":16,"hostname":"pepr-static-test-watcher-559d94447f-xkq2h","method":"GET","url":"/healthz","status":200,"duration":"1 ms"}
```

## Customizing Watch Configuration

The Watch configuration is a part of the Pepr module that allows you to watch for specific resources in the Kubernetes cluster. The Watch configuration can be customized by specific environment variables of the Watcher Deployment and can be set in the field in the `package.json` or in the helm `values.yaml` file.

| Field                          | Description                                                                                                        | Example Values                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `PEPR_RESYNC_FAILURE_MAX`      | The maximum number of times to fail on a resync interval before re-establishing the watch URL and doing a relist.  | default: `"5"`                    |
| `PEPR_RETRY_DELAY_SECONDS`     | The delay between retries in seconds.                                                                              | default: `"10"`                   |
| `PEPR_LAST_SEEN_LIMIT_SECONDS` | Max seconds to go without receiving a watch event before re-establishing the watch                                 | default: `"300"` (5 mins)         |
| `PEPR_RELIST_INTERVAL_SECONDS` | Amount of seconds to wait before a relist of the watched resources                                                 | default: `"600"` (10 mins)        |

## Customizing Webhook Server Timeouts

The admission webhook server's HTTP timeouts can be tuned via environment variables on the Admission Deployment.

| Field                        | Description                                                        | Example Values           |
| ---------------------------- | ------------------------------------------------------------------ | ------------------------ |
| `PEPR_KEEP_ALIVE_TIMEOUT_MS` | Idle timeout on persistent connections (`server.keepAliveTimeout`) | default: `"90000"` (90s) |
| `PEPR_HEADERS_TIMEOUT_MS`    | Max time to receive full HTTP headers (`server.headersTimeout`)    | default: `"32000"` (32s) |

## Configuring Reconcile

The [Reconcile Action](../actions/reconcile.md) allows you to maintain ordering of resource updates processed by a Pepr controller. The Reconcile configuration can be customized via environment variable on the Watcher Deployment, which can be set in the `package.json` or in the helm `values.yaml` file.

| Field                     | Description                                                 | Example Values          |
| -                         | -                                                           | -                       |
| `PEPR_RECONCILE_STRATEGY` | How Pepr should order resource updates being Reconcile()'d. | default: `"kindNsName"` |

| Available Options |
| -                 | -                                                                                             |
| `kind`            | separate queues of events for Reconcile()'d resources of a kind                               |
| `kindNs`          | separate queues of events for Reconcile()'d resources of a kind, within a namespace           |
| `kindNsName`      | separate queues of events for Reconcile()'d resources of a kind, within a namespace, per name |
| `global`          | a single queue of events for all Reconcile()'d resources                                      |

## Customizing with Helm

Below are the available Helm override configurations after you have built your Pepr module that you can put in the `values.yaml`. Generated internal values such as `uuid`, `hash`, and `secrets` are intentionally omitted.

### Helm Values Reference

| Path | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `additionalIgnoredNamespaces` | `list` | `[]` | Extra namespaces to ignore in addition to configured ignored namespaces. |
| `admission.affinity` | `object` | `{}` | Admission pod affinity settings. |
| `admission.annotations.pepr.dev/description` | `string` | `<from package.json>` | Admission Deployment description annotation. |
| `admission.antiAffinity` | `boolean` | `false` | Whether admission pods should be scheduled on separate nodes. |
| `admission.containerSecurityContext.allowPrivilegeEscalation` | `boolean` | `false` | Admission container privilege escalation setting. |
| `admission.containerSecurityContext.capabilities.drop` | `list` | `["ALL"]` | Linux capabilities dropped from the admission container. |
| `admission.containerSecurityContext.runAsGroup` | `integer` | `65532` | Group ID for the admission container process. |
| `admission.containerSecurityContext.runAsNonRoot` | `boolean` | `true` | Whether the admission container must run as non-root. |
| `admission.containerSecurityContext.runAsUser` | `integer` | `65532` | User ID for the admission container process. |
| `admission.enabled` | `boolean` | `true` | Whether to render the admission controller resources. |
| `admission.env` | `list` | `<from package.json>` | Environment variables for the admission container. |
| `admission.envFrom` | `list` | `[]` | Additional `envFrom` sources for the admission container. |
| `admission.extraVolumeMounts` | `list` | `[]` | Additional volume mounts for the admission container. |
| `admission.extraVolumes` | `list` | `[]` | Additional volumes for the admission pod. |
| `admission.failurePolicy` | `string` | `<from package.json>` | Admission webhook failure policy. |
| `admission.image` | `string` | `<from build>` | Admission controller image. |
| `admission.labels.app` | `string` | `<generated>` | Generated app label for the admission Deployment. |
| `admission.labels.pepr.dev/controller` | `string` | `<generated>` | Generated controller label for the admission Deployment. |
| `admission.labels.pepr.dev/uuid` | `string` | `<generated>` | Generated module UUID label for the admission Deployment. |
| `admission.livenessProbe.failureThreshold` | `integer` | `3` | Admission liveness probe failure threshold. |
| `admission.livenessProbe.httpGet.path` | `string` | `"/healthz"` | Admission liveness probe HTTP path. |
| `admission.livenessProbe.httpGet.port` | `integer` | `3000` | Admission liveness probe HTTP port. |
| `admission.livenessProbe.httpGet.scheme` | `string` | `"HTTPS"` | Admission liveness probe HTTP scheme. |
| `admission.livenessProbe.initialDelaySeconds` | `integer` | `10` | Admission liveness probe initial delay. |
| `admission.livenessProbe.periodSeconds` | `integer` | `10` | Admission liveness probe interval. |
| `admission.livenessProbe.successThreshold` | `integer` | `1` | Admission liveness probe success threshold. |
| `admission.livenessProbe.timeoutSeconds` | `integer` | `1` | Admission liveness probe timeout. |
| `admission.nodeSelector` | `object` | `{}` | Admission pod node selector. |
| `admission.podAnnotations` | `object` | `{}` | Additional annotations for the admission pod. |
| `admission.podLabels` | `object` | `{}` | Additional labels for the admission pod. |
| `admission.readinessProbe.failureThreshold` | `integer` | `3` | Admission readiness probe failure threshold. |
| `admission.readinessProbe.httpGet.path` | `string` | `"/healthz"` | Admission readiness probe HTTP path. |
| `admission.readinessProbe.httpGet.port` | `integer` | `3000` | Admission readiness probe HTTP port. |
| `admission.readinessProbe.httpGet.scheme` | `string` | `"HTTPS"` | Admission readiness probe HTTP scheme. |
| `admission.readinessProbe.initialDelaySeconds` | `integer` | `10` | Admission readiness probe initial delay. |
| `admission.readinessProbe.periodSeconds` | `integer` | `10` | Admission readiness probe interval. |
| `admission.readinessProbe.successThreshold` | `integer` | `1` | Admission readiness probe success threshold. |
| `admission.readinessProbe.timeoutSeconds` | `integer` | `1` | Admission readiness probe timeout. |
| `admission.resources.limits.cpu` | `string` | `"500m"` | Admission container CPU limit. |
| `admission.resources.limits.memory` | `string` | `"512Mi"` | Admission container memory limit. |
| `admission.resources.requests.cpu` | `string` | `"200m"` | Admission container CPU request. |
| `admission.resources.requests.memory` | `string` | `"256Mi"` | Admission container memory request. |
| `admission.securityContext.fsGroup` | `integer` | `<image-dependent>` | Admission pod filesystem group. |
| `admission.securityContext.runAsGroup` | `integer` | `<image-dependent>` | Admission pod group ID. |
| `admission.securityContext.runAsNonRoot` | `boolean` | `true` | Whether the admission pod must run as non-root. |
| `admission.securityContext.runAsUser` | `integer` | `<image-dependent>` | Admission pod user ID. |
| `admission.serviceMonitor.annotations` | `object` | `{}` | Admission ServiceMonitor annotations. |
| `admission.serviceMonitor.enabled` | `boolean` | `false` | Whether to render the admission ServiceMonitor. |
| `admission.serviceMonitor.labels` | `object` | `{}` | Admission ServiceMonitor labels. |
| `admission.startupProbe.failureThreshold` | `integer` | `3` | Admission startup probe failure threshold. |
| `admission.startupProbe.httpGet.path` | `string` | `"/healthz"` | Admission startup probe HTTP path. |
| `admission.startupProbe.httpGet.port` | `integer` | `3000` | Admission startup probe HTTP port. |
| `admission.startupProbe.httpGet.scheme` | `string` | `"HTTPS"` | Admission startup probe HTTP scheme. |
| `admission.startupProbe.initialDelaySeconds` | `integer` | `10` | Admission startup probe initial delay. |
| `admission.startupProbe.periodSeconds` | `integer` | `10` | Admission startup probe interval. |
| `admission.startupProbe.successThreshold` | `integer` | `1` | Admission startup probe success threshold. |
| `admission.startupProbe.timeoutSeconds` | `integer` | `1` | Admission startup probe timeout. |
| `admission.terminationGracePeriodSeconds` | `integer` | `5` | Admission pod termination grace period. |
| `admission.tolerations` | `list` | `[]` | Admission pod tolerations. |
| `admission.webhookAnnotations` | `object` | `{}` | Admission webhook resource annotations. |
| `admission.webhookLabels` | `object` | `{}` | Admission webhook resource labels. |
| `admission.webhookTimeout` | `integer` | `<from package.json>` | Admission webhook timeout in seconds. |
| `imagePullSecrets` | `list` | `[]` | Image pull secrets used by generated controller pods. |
| `namespace.annotations` | `object` | `{}` | Namespace annotations. |
| `namespace.labels.pepr.dev` | `string` | `""` | Default namespace label value. |
| `rbac` | `list` | `[]` | RBAC rules rendered into the chart. |
| `watcher.affinity` | `object` | `{}` | Watcher pod affinity settings. |
| `watcher.annotations.pepr.dev/description` | `string` | `<from package.json>` | Watcher Deployment description annotation. |
| `watcher.containerSecurityContext.allowPrivilegeEscalation` | `boolean` | `false` | Watcher container privilege escalation setting. |
| `watcher.containerSecurityContext.capabilities.drop` | `list` | `["ALL"]` | Linux capabilities dropped from the watcher container. |
| `watcher.containerSecurityContext.runAsGroup` | `integer` | `65532` | Group ID for the watcher container process. |
| `watcher.containerSecurityContext.runAsNonRoot` | `boolean` | `true` | Whether the watcher container must run as non-root. |
| `watcher.containerSecurityContext.runAsUser` | `integer` | `65532` | User ID for the watcher container process. |
| `watcher.enabled` | `boolean` | `true` | Whether to render the watcher controller resources. |
| `watcher.env` | `list` | `<from package.json>` | Environment variables for the watcher container. |
| `watcher.envFrom` | `list` | `[]` | Additional `envFrom` sources for the watcher container. |
| `watcher.extraVolumeMounts` | `list` | `[]` | Additional volume mounts for the watcher container. |
| `watcher.extraVolumes` | `list` | `[]` | Additional volumes for the watcher pod. |
| `watcher.image` | `string` | `<from build>` | Watcher controller image. |
| `watcher.labels.app` | `string` | `<generated>` | Generated app label for the watcher Deployment. |
| `watcher.labels.pepr.dev/controller` | `string` | `<generated>` | Generated controller label for the watcher Deployment. |
| `watcher.labels.pepr.dev/uuid` | `string` | `<generated>` | Generated module UUID label for the watcher Deployment. |
| `watcher.livenessProbe.failureThreshold` | `integer` | `3` | Watcher liveness probe failure threshold. |
| `watcher.livenessProbe.httpGet.path` | `string` | `"/healthz"` | Watcher liveness probe HTTP path. |
| `watcher.livenessProbe.httpGet.port` | `integer` | `3000` | Watcher liveness probe HTTP port. |
| `watcher.livenessProbe.httpGet.scheme` | `string` | `"HTTPS"` | Watcher liveness probe HTTP scheme. |
| `watcher.livenessProbe.initialDelaySeconds` | `integer` | `10` | Watcher liveness probe initial delay. |
| `watcher.livenessProbe.periodSeconds` | `integer` | `10` | Watcher liveness probe interval. |
| `watcher.livenessProbe.successThreshold` | `integer` | `1` | Watcher liveness probe success threshold. |
| `watcher.livenessProbe.timeoutSeconds` | `integer` | `1` | Watcher liveness probe timeout. |
| `watcher.nodeSelector` | `object` | `{}` | Watcher pod node selector. |
| `watcher.podAnnotations` | `object` | `{}` | Additional annotations for the watcher pod. |
| `watcher.podLabels` | `object` | `{}` | Additional labels for the watcher pod. |
| `watcher.readinessProbe.failureThreshold` | `integer` | `3` | Watcher readiness probe failure threshold. |
| `watcher.readinessProbe.httpGet.path` | `string` | `"/healthz"` | Watcher readiness probe HTTP path. |
| `watcher.readinessProbe.httpGet.port` | `integer` | `3000` | Watcher readiness probe HTTP port. |
| `watcher.readinessProbe.httpGet.scheme` | `string` | `"HTTPS"` | Watcher readiness probe HTTP scheme. |
| `watcher.readinessProbe.initialDelaySeconds` | `integer` | `10` | Watcher readiness probe initial delay. |
| `watcher.readinessProbe.periodSeconds` | `integer` | `10` | Watcher readiness probe interval. |
| `watcher.readinessProbe.successThreshold` | `integer` | `1` | Watcher readiness probe success threshold. |
| `watcher.readinessProbe.timeoutSeconds` | `integer` | `1` | Watcher readiness probe timeout. |
| `watcher.resources.limits.cpu` | `string` | `"500m"` | Watcher container CPU limit. |
| `watcher.resources.limits.memory` | `string` | `"512Mi"` | Watcher container memory limit. |
| `watcher.resources.requests.cpu` | `string` | `"200m"` | Watcher container CPU request. |
| `watcher.resources.requests.memory` | `string` | `"256Mi"` | Watcher container memory request. |
| `watcher.securityContext.fsGroup` | `integer` | `<image-dependent>` | Watcher pod filesystem group. |
| `watcher.securityContext.runAsGroup` | `integer` | `<image-dependent>` | Watcher pod group ID. |
| `watcher.securityContext.runAsNonRoot` | `boolean` | `true` | Whether the watcher pod must run as non-root. |
| `watcher.securityContext.runAsUser` | `integer` | `<image-dependent>` | Watcher pod user ID. |
| `watcher.serviceMonitor.annotations` | `object` | `{}` | Watcher ServiceMonitor annotations. |
| `watcher.serviceMonitor.enabled` | `boolean` | `false` | Whether to render the watcher ServiceMonitor. |
| `watcher.serviceMonitor.labels` | `object` | `{}` | Watcher ServiceMonitor labels. |
| `watcher.startupProbe.failureThreshold` | `integer` | `3` | Watcher startup probe failure threshold. |
| `watcher.startupProbe.httpGet.path` | `string` | `"/healthz"` | Watcher startup probe HTTP path. |
| `watcher.startupProbe.httpGet.port` | `integer` | `3000` | Watcher startup probe HTTP port. |
| `watcher.startupProbe.httpGet.scheme` | `string` | `"HTTPS"` | Watcher startup probe HTTP scheme. |
| `watcher.startupProbe.initialDelaySeconds` | `integer` | `10` | Watcher startup probe initial delay. |
| `watcher.startupProbe.periodSeconds` | `integer` | `10` | Watcher startup probe interval. |
| `watcher.startupProbe.successThreshold` | `integer` | `1` | Watcher startup probe success threshold. |
| `watcher.startupProbe.timeoutSeconds` | `integer` | `1` | Watcher startup probe timeout. |
| `watcher.terminationGracePeriodSeconds` | `integer` | `5` | Watcher pod termination grace period. |
| `watcher.tolerations` | `list` | `[]` | Watcher pod tolerations. |

## Customizing with package.json

### package.json Configurations Table

| Field                | Description                             | Example Values                                                                         |
| -------              | -------------                           | ----------------                                                                       |
| `uuid`               | Unique identifier for the module        | `hub-operator`                                                                         |
| `onError`            | Behavior of the webhook failure policy  | `audit`, `ignore`, `reject`                                                            |
| `webhookTimeout`     | Webhook timeout in seconds              | `1` - `30`                                                                             |
| `customLabels`       | Custom labels for namespaces            | `{namespace: {}}`                                                                      |
| `alwaysIgnore`       | Conditions to always ignore             | `{namespaces: []}`                                                                     |
| `admission`          | admission namespaces to always ignore   | `{alwaysIgnore: {namespaces: []}}`                                                     |
| `watch`              | watcher namespaces to always ignore     | `{alwaysIgnore: {namespaces: []}}`                                                     |
| `includedFiles`      | For working with WebAssembly            | ["main.wasm", "wasm_exec.js"]                                                          |
| `env`                | Environment variables for the container | `{LOG_LEVEL: "warn"}`                                                                  |
| `rbac`               | Custom RBAC rules                       | `[{"apiGroups": ["<apiGroups>"], "resources": ["<resources>"], "verbs": ["<verbs>"]}]` |
| `rbacMode`           | RBAC mode                               | `scoped`, `admin`                                                                      |
| `additionalWebhooks` | Additional webhooks configuration       | `[{"failurePolicy": "Fail", "namespace": "example-namespace"}]`                        |
