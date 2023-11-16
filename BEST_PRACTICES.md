# Pepr Best Practices

## TOC

- [Store](#pepr-store)
- [OnSchedule](#onschedule)
- [Watch](#watch)


## Pepr Store

The store is backed by ETCD in a `PeprStore` resource, and updates happen at 5-second intervals when an array of patches is sent to the Kubernetes API Server. The store is intentionally not designed to be `transactional`; instead, it is built to be eventually consistent, meaning that the last operation within the interval will be persisted, potentially overwriting other operations. In simpler terms, changes to the data are made without a guarantee that they will occur simultaneously, so caution is needed in managing errors and ensuring consistency.  


## OnSchedule

`OnSchedule` is supported by a `PeprStore` to safeguard against schedule loss following a pod restart. It is utilized at the top level, distinct from being within a `Validate`, `Mutate`, or `Watch`. Recommended intervals are 30 seconds or longer, and jobs are advised to be idempotent, meaning that if the code is applied or executed multiple times, the outcome should be the same as if it had been executed only once. A major use-case for `OnSchedule` is day 2 operations.

## Watch

Pepr facilitates efficient change notifications on resources through `Watch`. It is recommended to use `Watch` instead of `Mutate` or `Validate` when longer running operations are needed, as there is no [timeout limitation](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#timeouts). An instance where `Watch` is beneficial is when API calls need to be chained together, and `Watch` operations can be sequentially executed after `Mutate` and `Validate`.

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
