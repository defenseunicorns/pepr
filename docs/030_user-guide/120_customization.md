# Customization

This document outlines how to customize the build output through Helm overrides and `package.json` configurations.

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

The Watch configuration is a part of the Pepr module that allows you to watch for specific resources in the Kubernetes cluster. The Watch configuration can be customized by specific enviroment variables of the Watcher Deployment and can be set in the field in the `package.json` or in the helm `values.yaml` file.

| Field                        | Description                                                                                                      | Example Values                  |
|------------------------------|------------------------------------------------------------------------------------------------------------------|---------------------------------|
| `PEPR_RESYNC_FAILURE_MAX`    | The maximum number of times to fail on a resync interval before re-establishing the watch URL and doing a relist. | default: `"5"`                |
| `PEPR_RETRY_DELAY_SECONDS`     | The delay between retries in seconds.                                                                            | default: `"10"`                 |
| `PEPR_LAST_SEEN_LIMIT_SECONDS` | Max seconds to go without receiving a watch event before re-establishing the watch | default: `"300"` (5 mins)       |
| `PEPR_RELIST_INTERVAL_SECONDS` | Amount of seconds to wait before a relist of the watched resources  | default: `"600"` (10 mins)       |

## Configuring Reconcile

The [Reconcile Action](./030_actions/030_reconcile.md) allows you to maintain ordering of resource updates processed by a Pepr controller. The Reconcile configuration can be customized by specific enviroment variables of the Watcher Deployment and can be set in the `package.json` or in the helm `values.yaml` file.

| Field | Description | Example Values |
|-|-|-|
| `PEPR_RECONCILE_STRATEGY` | How Pepr should order resource updates being Reconcile()'d. | default: `"singular"` |

| Available Options ||
|-|-|
| `singular`  | Pepr will keep a single queue of events across _all_ Reconcile()'d resources of a kind.
| `sharded`   | Pepr will keep multiple queues of events, one for each resource _instance_ of a kind.



## Customizing with Helm

Below are the available Helm override configurations after you have built your Pepr module that you can put in the `values.yaml`.

### Helm Overrides Table

| Parameter                       | Description                               | Example Values                                 |
|---------------------------------|-------------------------------------------|------------------------------------------------|
| `secrets.apiToken`              | Kube API-Server Token.                    | `Buffer.from(apiToken).toString("base64")`     |
| `hash`                          | Unique hash for deployment. Do not change.| `<your_hash>`                                  |
| `namespace.annotations`         | Namespace annotations                     | `{}`                                           |
| `namespace.labels`              | Namespace labels                          | `{"pepr.dev": ""}`                             |
| `uuid`                          | Unique identifier for the module          | `hub-operator`                                 |
| `admission.*`                   | Admission controller configurations       | Various, see subparameters below               |
| `watcher.*`                     | Watcher configurations                    | Various, see subparameters below               |

### Admission and Watcher Subparameters

| Subparameter                                 | Description                                                         |
|----------------------------------------------|---------------------------------------------------------------------|
| `failurePolicy`                              | Webhook failure policy [Ignore, Fail]                               |
| `webhookTimeout`                             | Timeout seconds for webhooks [1 - 30]                               |
| `env`                                        | Container environment variables                                     |
| `image`                                      | Container image                                                     |
| `annotations`                                | Deployment annotations                                              |
| `labels`                                     | Deployment labels                                                   |
| `securityContext`                            | Pod security context                                                |
| `readinessProbe`                             | Pod readiness probe definition                                      |
| `livenessProbe`                              | Pod liveness probe definition                                       |
| `resources`                                  | Resource limits                                                     |
| `containerSecurityContext`                   | Container's security context                                        |
| `nodeSelector`                               | Node selection constraints                                          |
| `tolerations`                                | Tolerations to taints                                               |
| `affinity`                                   | Node scheduling options                                             |
| `terminationGracePeriodSeconds`              | Optional duration in seconds the pod needs to terminate gracefully  |

Note: Replace `*` with `admission` or `watcher` as needed to apply settings specifically for each part.

## Customizing with package.json

Below are the available configurations through `package.json`.

### package.json Configurations Table

| Field            | Description                            | Example Values                  |
|------------------|----------------------------------------|---------------------------------|
| `uuid`           | Unique identifier for the module       | `hub-operator`                  |
| `onError`        | Behavior of the webhook failure policy | `reject`, `ignore`              |
| `webhookTimeout` | Webhook timeout in seconds             | `1` - `30`                      |
| `customLabels`   | Custom labels for namespaces           | `{namespace: {}}`               |
| `alwaysIgnore`   | Conditions to always ignore            | `{namespaces: []}`  |
| `includedFiles`  | For working with WebAssembly           | ["main.wasm", "wasm_exec.js"]   |
| `env`            | Environment variables for the container| `{LOG_LEVEL: "warn"}`           |

These tables provide a comprehensive overview of the fields available for customization within the Helm overrides and the `package.json` file. Modify these according to your deployment requirements.
