# Customization

This document outlines how to customize the build output through Helm overrides and `package.json` configurations.

## Customizing Watch Configuration 

The Watch configuration is a part of the Pepr module that allows you to watch for specific resources in the Kubernetes cluster. The Watch configuration can be customized by specific enviroment variables of the Watcher Deployment and can be set in the field in the `package.json` or in the helm `values.yaml` file.

| Field                        | Description                                                                                                      | Example Values                  |
|------------------------------|------------------------------------------------------------------------------------------------------------------|---------------------------------|
| `PEPR_RETRYMAX`              | The maximum number of times to retry the watch, the retry count is reset on success.                             | default: `"5"`                  |
| `PEPR_RETRYDELAYSECONDS`     | The delay between retries in seconds.                                                                            | default: `"10"`                 |
| `PEPR_RESYNCINTERVALSECONDS` | Amount of seconds to wait before a forced-resyncing of the watch list                                            | default: `"300"` (5 mins)       |
| `PEPR_ALLOWWATCHBOOKMARKS`   | Whether to allow [watch bookmarks](https://kubernetes.io/docs/reference/using-api/api-concepts/#watch-bookmarks).| default: `"true"`  or `"false"` |


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
