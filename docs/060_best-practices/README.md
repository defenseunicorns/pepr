# Pepr Best Practices

## Table of Contents

- [Pepr Best Practices](#pepr-best-practices)
  - [Table of Contents](#table-of-contents)
  - [Mutating Webhook Errors](#mutating-webhook-errors)
  - [Core Development](#core-development)
  - [Debugging](#debugging)
  - [Deployment](#deployment)
  - [Keep Modules Small](#keep-modules-small)
  - [Monitoring](#monitoring)
  - [Multiple Modules or Multiple Capabilities](#multiple-modules-or-multiple-capabilities)
  - [OnSchedule](#onschedule)
  - [Reconcile](#reconcile)
  - [Security](#security)
  - [Pepr Store](#pepr-store)
  - [Watch](#watch)

## Mutating Webhook Errors

When developing mutating admission policies, it is essential to include a validation step immediately after applying mutations. This ensures that the changes made by the mutating admission policy were applied correctly and do not introduce unintended inconsistencies or invalid configurations into your Kubernetes cluster.

**Why Validate After Mutating?**

1.	Detect Misconfigurations Early:
Mutating admission policies modify incoming resource configurations dynamically. Without validation, you risk introducing invalid configurations into your cluster if the mutation logic contains bugs, unintended side effects, or even a [Webhook Timeout](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#timeouts).
2.	Maintain Cluster Integrity:
By validating the mutated resource, you ensure it adheres to expected formats, standards, and constraints, maintaining the health and stability of your cluster.
3.	Catch Logic Errors in Mutations:
A mutation may not always produce the intended output due to edge cases, unexpected inputs, or incorrect assumptions in the mutation logic. Validation helps catch such issues early.
4.	Comply with Kubernetes Best Practices:
Kubernetes resources must meet specific structural and functional requirements. Validating ensures compliance, preventing the risk of deployment failures or runtime errors.

**How to implement a Validate-After-Mutate Pattern**

1. Apply the desired transformations to the resource in the `Mutate` block.
2. Validate the mutated resource in the `Validate` block to ensure it adheres to the expected structure.
3. If the validation fails, reject the resource with a descriptive message explaining the issue.
```typescript
When(a.Pod)
  .IsCreated()
  .InNamespace("my-app")
  .WithName("database")
  .Mutate(po => po.SetLabel("pepr", "true"))
  .Validate(po => {
    if (po.Raw.metadata?.labels["pepr"] !== "true") {
      return po.Approve();
    }
    return po.Deny("Needs pepr label set to true")
  });
```

## Core Development

When developing new features in Pepr Core, it is recommended to use `npx pepr deploy -i pepr:dev`, which will deploy Pepr's Kubernetes manifests to the cluster with the development image. This will allow you to test your changes without having to build a new image and push it to a registry.

The workflow for developing features in Pepr is:

1. Run `npm test` which will create a k3d cluster and build a development image called `pepr:dev`
2. Deploy development image into the cluster with `npx pepr deploy -i pepr:dev`

## Debugging

- [Debugging During Module Development](https://docs.pepr.dev/main/best-practices/#debugging-during-module-development)
- [Logging](https://docs.pepr.dev/main/best-practices/#logging)
- [Internal Error Occurred](https://docs.pepr.dev/main/best-practices/#internal-error-occurred)
- [Pepr Store](https://docs.pepr.dev/main/best-practices/#pepr-store)


Welcome to the the debugging section! 🐛

Pepr is composed of `Modules` (ie, what happens when you issue `npx pepr init`), [Capabilities](https://docs.pepr.dev/main/user-guide/capabilities/) like `hello-pepr.ts`, and [Actions](https://docs.pepr.dev/main/user-guide/actions/) (ie, the blocks of code containing filters and `Mutate`, `Validate`, `Watch`, `Reconcile`, `OnSchedule`). You can have as many Capabilities as you would like in a Module.

Pepr is a webhook-based system, meaning it is event-driven. When a resource is created, updated, or deleted, Pepr is called to perform the actions you have defined in your Capabilities. It's common for multiple webhooks to exist in a cluster, not just Pepr. When there are multiple webhooks, the order in which they are called is not guaranteed. The only guarantee is that all of the `MutatingWebhooks` will be called before all of the `ValidatingWebhooks`. After the admission webhooks are called, the `Watch` and `Reconcile` are called. The `Reconcile` and `Watch` create a watch on the resources specified in the `When` block and are watched for changes after admission. The difference between reconcile and watch is that `Reconcile` processes events in a queue to guarantee that the events are processed in order where as watch does not. 

Considering that many webhooks may be modifying the same resource, it is best practice to validate the resource after mutations are made to ensure that the resource is in a valid state if it has been changed since the last mutation.



```typescript
When(a.Pod)
  .IsCreated()
  .InNamespace("my-app")
  .WithName("database")
  .Mutate(pod => {
    pod.metadata.labels["pepr"] = "true";
    return pod;
  })
  // another mutating webhook could removed labels
  .Validate(pod => {
    if (pod.metadata.labels["pepr"] !== "true") {
      return pod.Approve("Label 'pepr' must be 'true'");
    }
    return pod.Deny("Needs pepr label set to true")
  });
```

_If you think your Webhook is not being called for a given resource, check the `*WebhookConfiguration`._


### Debugging During Module Development

Pepr supports breakpoints in the VSCode editor. To use breakpoints, run `npx pepr dev` in the root of a Pepr module using a JavaScript Debug Terminal. This command starts the Pepr development server running at `localhost:3000` with the `*WebhookConfiguration` configured to send `AdmissionRequest` objects to the local address.

This allows you to set breakpoints in `Mutate()`, `Validate()`, `Reconcile()`, `Watch()` or `OnSchedule()` and step through module code.

Note that you will need a cluster running: 

```bash
k3d cluster create pepr-dev --k3s-arg '--debug@server:0' --wait
```

```typescript
When(a.Pod)
  .IsCreated()
  .InNamespace("my-app")
  .WithName("database")
  .Mutate(pod => {
    // Set a breakpoint here
    pod.metadata.labels["pepr"] = "true";
    return pod;
  })
  .Validate(pod => {
    // Set a breakpoint here
    if (pod.metadata.labels["pepr"] !== "true") {
      return ["Label 'pepr' must be 'true'"];
    }
  });
```

### Logging

Pepr can deploy two types of controllers: Admission and Watch. The controllers deployed are dictated by the [Actions](https://docs.pepr.dev/main/user-guide/actions/) called for by a given set of Capabilities (Pepr only deploys what is necessary). Within those controllers, the default log level is `info` but that can be changed to `debug` by setting the `LOG_LEVEL` environment variable to `debug`.

To pull logs for all controller pods:

```bash
kubectl logs -l app -n pepr-system
```

#### Admission Controller

If the focus of the debug is on a `Mutate()` or `Validate()`, the relevenat logs will be from pods with label `pepr.dev/controller: admission`.

```bash
kubectl logs -l pepr.dev/controller=admission -n pepr-system
```

More refined admission logs -- which can be optionally filtered by the module UUID -- can be obtained with [`npx pepr monitor`](https://docs.pepr.dev/main/best-practices/#monitoring)

```bash
npx pepr monitor 
```

#### Watch Controller

If the focus of the debug is a `Watch()`, `Reconcile()`, or `OnSchedule()`, look for logs from pods containing label `pepr.dev/controller: watcher`.

```bash
kubectl logs -l pepr.dev/controller=watcher -n pepr-system
```

### Internal Error Occurred

```bash
Error from server (InternalError): Internal error occurred: failed calling webhook "<pepr_module>pepr.dev": failed to call webhook: Post ...
```

When an internal error occurs, check the deployed `*WebhookConfiguration` resources' timeout and failurePolicy configurations. If the failurePolicy is set to `Fail`, and a request cannot be processed within the timeout, that request will be rejected. If the failurePolicy is set to `Ignore`, given the same timeout conditions, the request will (perhaps surprisingly) be allowed to continue.

If you have a validating webhook, the recommended is to set the failurePolicy to `Fail` to ensure that the request is rejected if the webhook fails.

```yaml
    failurePolicy: Fail
    matchPolicy: Equivalent
    timeoutSeconds: 3
```

The failurePolicy and timeouts can be set in the Module's `package.json` file, under the `pepr` configuration key.  If changed, the settings will be reflected in the `*WebhookConfiguration` after the next build:

```json
  "pepr": {
    "uuid": "static-test",
    "onError": "ignore", 
    "webhookTimeout": 10,
  }
```

Read more on customization [here](https://docs.pepr.dev/main/user-guide/customization/).


### Pepr Store

If you need to read all store keys, or you think the PeprStore is malfunctioning, you can check the PeprStore CR:

```bash
kubectl get peprstore  -n pepr-system -o yaml
```

You should run in `npx pepr dev` mode to debug the issue, see the [Debugging During Module Development](https://docs.pepr.dev/main/best-practices/#debugging-during-module-development) section for more information.

## Deployment

Production environment deployments should be `declarative` in order to avoid mistakes. The Pepr modules should be generated with `npx pepr build` and moved into the appropriate location.

Development environment deployments can use `npx pepr deploy` to deploy Pepr's Kubernetes manifests into the cluster or `npx pepr dev` to active debug the Pepr module with breakpoints in the code editor.

## Keep Modules Small

Modules are minified and built JavaScript files that are stored in a Kubernetes Secret in the cluster. The Secret is mounted in the Pepr Pod and is processed by Pepr Core. Due to the nature of the module being packaged in a Secret, it is recommended to keep the modules as small as possible to avoid hitting the [1MB limit](https://kubernetes.io/docs/concepts/configuration/secret/#restriction-data-size) of secrets.

Recommendations for keeping modules small are:

- Don't repeat yourself
- Only import the part of the library modules that you need

It is suggested to lint and format your modules using `npx pepr format`.

## Monitoring

Pepr can monitor Mutations and Validations from Admission Controller the through the `npx pepr monitor [module-uuid]` command. This command will display neatly formatted log showing approved and rejected Validations as well as the Mutations.  If `[module-uuid]` is not supplied, then it uses all Pepr admission controller logs as the data source. If you are unsure of what modules are currently deployed, issue `npx pepr uuid` to display the modules and their descriptions.

```plaintext
✅  MUTATE     pepr-demo/pepr-demo (50c5d836-335e-4aa5-8b56-adecb72d4b17)

✅  VALIDATE   pepr-demo/example-2 (01c1d044-3a33-4160-beb9-01349e5d7fea)

❌  VALIDATE   pepr-demo/example-evil-cm (8ee44ca8-845c-4845-aa05-642a696b51ce)
[ 'No evil CM annotations allowed.' ]
```

## Multiple Modules or Multiple Capabilities

Each module has it's own Mutating, Validating webhook configurations, Admission and Watch Controllers and Stores. This allows for each module to be deployed independently of each other. However, creating multiple modules creates overhead on the kube-apiserver, and the cluster.

Due to the overhead costs, it is recommended to deploy multiple capabilities that share the same resources (when possible). This will simplify analysis of which capabilities are responsible for changes on resources.

However, there are some cases where multiple modules makes sense. For instance different teams owning separate modules, or one module for Validations and another for Mutations. If you have a use-case where you need to deploy multiple modules it is recommended to separate concerns by operating in different namespaces.

## OnSchedule

`OnSchedule` is supported by a `PeprStore` to safeguard against schedule loss following a pod restart. It is utilized at the top level, distinct from being within a `Validate`, `Mutate`, `Reconcile` or `Watch`. Recommended intervals are 30 seconds or longer, and jobs are advised to be idempotent, meaning that if the code is applied or executed multiple times, the outcome should be the same as if it had been executed only once. A major use-case for `OnSchedule` is day 2 operations.

## Security

To enhance the security of your Pepr Controller, we recommend following these best practices:

- Regularly update Pepr to the latest stable release.
- Secure Pepr through RBAC using [scoped mode](https://docs.pepr.dev/main/user-guide/rbac/#scoped) taking into account access to the Kubernetes API server needed in the callbacks.
- Practice the principle of least privilege when assigning roles and permissions and avoid giving the service account more permissions than necessary.
- Use NetworkPolicy to restrict traffic from Pepr Controllers to the minimum required.
- Limit calls from Pepr to the Kubernetes API server to the minimum required.
- Set webhook failure policies to `Fail` to ensure that the request is rejected if the webhook fails. More Below..

When using Pepr as a `Validating` Webhook, it is recommended to set the Webhook's `failurePolicy` to `Fail`. This can be done in your Pepr module in the`values.yaml` file of the helm chart by setting `admission.failurePolicy` to `Fail` or in the `package.json` under `pepr` by setting the `onError` flag to `reject`, then running `npx pepr build` again.

By following these best practices, you can help protect your Pepr Controller from potential security threats.

## Reconcile 

Fills a similar niche to .Watch() -- and runs in the Watch Controller -- but it employs a Queue to force sequential processing of resource states once they are returned by the Kubernetes API. This allows things like operators to handle bursts of events without overwhelming the system or the Kubernetes API. It provides a mechanism to back off when the system is under heavy load, enhancing overall stability and maintaining the state consistency of Kubernetes resources, as the order of operations can impact the final state of a resource. For example, creating and then deleting a resource should be processed in that exact order to avoid state inconsistencies.

```typescript
When(WebApp)
  .IsCreatedOrUpdated()
  .Validate(validator)
  .Reconcile(async instance => {
     // Do WORK HERE
```

## Pepr Store

The store is backed by ETCD in a `PeprStore` resource, and updates happen at 5-second intervals when an array of patches is sent to the Kubernetes API Server. The store is intentionally not designed to be `transactional`; instead, it is built to be eventually consistent, meaning that the last operation within the interval will be persisted, potentially overwriting other operations. In simpler terms, changes to the data are made without a guarantee that they will occur simultaneously, so caution is needed in managing errors and ensuring consistency.

## Watch

Pepr streamlines the process of receiving timely change notifications on resources by employing the `Watch` mechanism. It is advisable to opt for `Watch` over `Mutate` or `Validate` when dealing with more extended operations, as `Watch` does not face any [timeout limitations](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#timeouts). Additionally, `Watch` proves particularly advantageous for monitoring previously existing resources within a cluster. One compelling scenario for leveraging `Watch` is when there is a need to chain API calls together, allowing `Watch` operations to be sequentially executed following `Mutate` and `Validate` actions.

```typescript
When(a.Pod)
  .IsCreated()
  .InNamespace("my-app")
  .WithName("database")
  .Mutate(pod => // .... )
  .Validate(pod => // .... )
  .Watch(async (pod, phase) => {
    Log.info(pod, `Pod was ${phase}.`);

    // do consecutive api calls
```

[TOP](#pepr-best-practices)
