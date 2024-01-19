# Pepr Best Practices

## TOC

- [Deployment](#deployment)
- [Keep Modules Small](#keep-modules-small)
- [core development](#core-development)
- [debugging](#debugging)
- [OnSchedule](#onschedule)
- [Security](#security)
- [monitoring](#monitoring)
- [Store](#pepr-store)
- [Watch](#watch)
- [multiple-modules-or-multiple-capabilities](#multiple-modules-or-multiple-capabilities)

## Deployment

The recommended approach for production deployments is `declaratively` rather than `imperatively`. `npx pepr deploy` should only be used in development.

## Core Development

When developing new features in Pepr Core, it is recommended to to use `npx pepr 
deploy -i pepr:dev`, which will deploy Pepr's Kubernetes manifests to the cluster with the development image. This will allow you to test your changes without having to build a new image and push it to a registry. 


## Keep Modules Small

Modules are minified and built JavaScript files that are stored in a Kubernetes Secret in the cluster. The Secret is mounted in the Pepr container and is processed by Pepr Core. Due to the nature of the module being packaged in a secret, it is recommended to keep the modules as small as possible to avoid hitting the [1MB limit](https://kubernetes.io/docs/concepts/configuration/secret/#restriction-data-size) of secrets.

Recommendations for keeping models small are:
- Don't repeat yourself 
- Only import the part of the library modules that you need



## Debugging

Pepr can be broken down into two parts: admission and watches. If the focus of the debug is on a mutation or validation, then only pay attention to pods with labels `pepr.dev/controller: admission`. If you are building an operator or dealing with resources that already exist in the cluster (not through admission), then `pepr.dev/controller: watch` are the pods to pay attention to.


## Monitoring

Pepr can monitor its validations and mutations through the `npx pepr monitor <module-uuid>` command. This command will display a list of acrtions peformed by Pepr's the Admission Controller.


## Security 

Pepr is designed to be secure by default by creating securityContext limiting the scope of privilege on pods. This is done by setting the `runAsNonRoot` and `runAsUser` fields in the `securityContext` of the pod. This is done by default for all pods created by Pepr. 

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


## OnSchedule

`OnSchedule` is supported by a `PeprStore` to safeguard against schedule loss following a pod restart. It is utilized at the top level, distinct from being within a `Validate`, `Mutate`, or `Watch`. Recommended intervals are 30 seconds or longer, and jobs are advised to be idempotent, meaning that if the code is applied or executed multiple times, the outcome should be the same as if it had been executed only once. A major use-case for `OnSchedule` is day 2 operations.

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

## Multiple Modules or Multiple Capabilities

Each module has it's own mutating, validating webhook configurations, admission and watch controllers and stores. This allows for each module to be deployed independently of each other. However, creating multiple modules creates overhead on the kube-apiserver, and the cluster.

Due to the overhead costs, it is recommended to deploy multiple capabilies that share the the same resources. This will simplify analysis of which capabilities are responsible for changes on resources.

However, there are some cases where it is makes sense multiple modules. The recommendation when deploying multiple modules it to separate concerns and keep the modules as small as possible.

[TOP](#pepr-best-practices)
