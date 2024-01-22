# Pepr Best Practices

## Table of Contents

- [Pepr Best Practices](#pepr-best-practices)
  - [Table of Contents](#table-of-contents)
  - [Core Development](#core-development)
  - [Debugging](#debugging)
  - [Deployment](#deployment)
  - [Keep Modules Small](#keep-modules-small)
  - [Monitoring](#monitoring)
  - [Multiple Modules or Multiple Capabilities](#multiple-modules-or-multiple-capabilities)
  - [OnSchedule](#onschedule)
  - [Security](#security)
  - [Pepr Store](#pepr-store)
  - [Watch](#watch)

## Core Development

When developing new features in Pepr Core, it is recommended to use `npx pepr deploy -i pepr:dev`, which will deploy Pepr's Kubernetes manifests to the cluster with the development image. This will allow you to test your changes without having to build a new image and push it to a registry.

The workflow for developing features in Pepr is:

1. Run `npm test` which will create a k3d cluster and build a development image called `pepr:dev`
2. Deploy development image into the cluster with `npx pepr deploy -i pepr:dev`

## Debugging

Pepr can be broken down into two parts: Admission and Watches. If the focus of the debug is on a Mutation or Validation, then only pay attention to pods with labels `pepr.dev/controller: admission`, else, you can focus on `pepr.dev/controller: watch`.

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

Pepr can monitor Mutations and Validations from Admission Controller the through the `npx pepr monitor [module-uuid]` command. This command will display neatly formatted log showing approved and rejected Validations as well as the Mutations.  If `[module-uuid]` is not supplied, then it uses all Pepr admission controller logs as the data source.

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

`OnSchedule` is supported by a `PeprStore` to safeguard against schedule loss following a pod restart. It is utilized at the top level, distinct from being within a `Validate`, `Mutate`, or `Watch`. Recommended intervals are 30 seconds or longer, and jobs are advised to be idempotent, meaning that if the code is applied or executed multiple times, the outcome should be the same as if it had been executed only once. A major use-case for `OnSchedule` is day 2 operations.

## Security

In terms of Pepr security, it is recommended to generate a Pepr Module's Kubernetes manifests using `scoped` rbac mode: `npx pepr build --rbac-mode=scoped`. This will give the `ServiceAccount` just enough permissions to do the Watch on the given Kubernetes resources.

Note: If you are manipulating additional resources in the `Validate`, `Mutate`, or `Watch` callbacks, then you will need to account for them in the `ClusterRole`.

When using Pepr as a `Validating` Webhook, it is recommended to set the Webhook's `failurePolicy` to `Fail`. In your Pepr module, this is handled in the `package.json` under `pepr` by setting the `onError` flag to `reject`, then running `npx pepr build` again. When creating a Pepr module for the first time the user is prompted how to handle errors and this is where the flag is initially set.

In terms of building Pepr modules for security, a good place to start is by assigning sane defaults to Pod's and Container's `securityContext`. Below would be an extremely simplified version of assigning `runAsNonRoot` and the `runAsUser` on the Pod.

```typescript
When(a.Pod)
  .IsCreated()
  .InNamespace("my-app")
  .WithName("database")
  .Mutate(pod => {
    pod.spec.securityContext = {
      runAsNonRoot: true,
      runAsUser: 1000
    }
  })
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
