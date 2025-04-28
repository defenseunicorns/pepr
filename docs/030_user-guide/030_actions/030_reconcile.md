# Reconcile

Reconcile functions the same as Watch but is tailored for building Kubernetes Controllers and Operators because it processes callback operations in a [Queue](https://github.com/defenseunicorns/pepr/blob/f01f5eeda16c13ecd0d51b26b8a16ed7e4c1b080/src/lib/watch-processor.ts#L86), guaranteeing ordered and synchronous processing of events, even when the system may be under heavy load.

Ordering can be configured to operate in one of two ways: as a single queue that maintains ordering of operations across all resources of a kind (default) or with separate processing queues per resource instance.

See [Configuring Reconcile](../120_customization.md#configuring-reconcile) for more on configuring how Reconcile behaves.

```ts
When(WebApp)
  .IsCreatedOrUpdated()
  .Validate(validator) // Validate the shape of the resource
  .Reconcile(async instance => {
    try {
      Store.setItem(instance.metadata.name, JSON.stringify(instance));
      await reconciler(instance); // Reconcile the resource - Deploy Kubernetes manifests, etc.
    } catch (error) {
      Log.info(`Error reconciling instance of WebApp`);
    }
  });

export async function validator(req: PeprValidateRequest<WebApp>) {
  const ns = req.Raw.metadata?.namespace ?? "_unknown_";

  if (req.Raw.spec.replicas > 7) {
    return req.Deny("max replicas is 7 to prevent noisy neighbors");
  }
  if (invalidNamespaces.includes(ns)) {
    if (req.Raw.metadata?.namespace === "default") {
      return req.Deny("default namespace is not allowed");
    }
    return req.Deny("invalid namespace");
  }

  return req.Approve();
}
```
