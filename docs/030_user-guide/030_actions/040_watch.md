# Watch

[Kubernetes](https://kubernetes.io/docs/reference/using-api/api-concepts) supports efficient change notifications on resources via watches. Pepr uses the Watch action for monitoring resources that previously existed in the cluster and for performing long-running asynchronous events upon receiving change notifications on resources, as watches are not limited by [timeouts](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#timeouts).

```ts
When(a.Namespace)
  .IsCreated()
  .WithName("pepr-demo-2")
  .Watch(async ns => {
    Log.info("Namespace pepr-demo-2 was created.");

    try {
      // Apply the ConfigMap using K8s server-side apply
      await K8s(kind.ConfigMap).Apply({
        metadata: {
          name: "pepr-ssa-demo",
          namespace: "pepr-demo-2",
        },
        data: {
          "ns-uid": ns.metadata.uid,
        },
      });
    } catch (error) {
      // You can use the Log object to log messages to the Pepr controller pod
      Log.error(error, "Failed to apply ConfigMap using server-side apply.");
    }

    // You can share data between actions using the Store, including between different types of actions
    Store.setItem("watch-data", "This data was stored by a Watch Action.");
  });
```
