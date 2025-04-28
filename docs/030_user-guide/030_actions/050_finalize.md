# Finalize

A specialized combination of Pepr's [Mutate](./010_mutate.md) & [Watch](./040_watch.md) functionalities that allow a module author to run logic while Kubernetes is [Finalizing](https://kubernetes.io/docs/concepts/overview/working-with-objects/finalizers/) a resource (i.e. cleaning up related resources _after_ a deleteion request has been accepted). `Finalize()` can only be accessed after a `Watch()` or `Reconcile()`.

This method will:

1. Inject a finalizer into the `metadata.finalizers` field of the requested resource during the mutation phase of the admission.

1. Watch appropriate resource lifecycle events & invoke the given callback.

1. Remove the injected finalizer from the `metadata.finalizers` field of the requested resource.

```ts
When(a.ConfigMap)
  .IsCreated()
  .InNamespace("hello-pepr-finalize-create")
  .WithName("cm-reconcile-create")
  .Reconcile(function reconcileCreate(cm) {
    Log.info(cm, "external api call (create): reconcile/callback")
  })
  .Finalize(function finalizeCreate(cm) {
    Log.info(cm, "external api call (create): reconcile/finalize")
  });
```
