# Actions

## Overview

An action is a discrete set of behaviors defined in a single function that acts on a given Kubernetes GroupVersionKind (GVK) passed in during the admission controller lifecycle. Actions are the atomic operations that are performed on Kubernetes resources by Pepr.

For example, an action could be responsible for adding a specific label to a Kubernetes resource, or for modifying a specific field in a resource's metadata. Actions can be grouped together within a Capability to provide a more comprehensive set of operations that can be performed on Kubernetes resources.

Actions are `Mutate()`, `Validate()`, `Watch()`, `Reconcile()`, and `Finalize()`. Both Mutate and Validate actions run during the admission controller lifecycle, while Watch and Reconcile actions run in a separate controller that tracks changes to resources, including existing resource; the Finalize action spans both the admission & afterward.

Let's look at some example actions that are included in the `HelloPepr` capability that is created for you when you [`npx pepr init`](./010_pepr-cli.md#pepr-init):

---

In this first example, Pepr is adding a label and annotation to a ConfigMap with the name `example-1` when it is created. Comments are added to each line to explain in more detail what is happening.

```ts
// When(a.<Kind>) filters which GroupVersionKind (GVK) this action should act on.
When(a.ConfigMap)
  // This limits the action to only act on new resources.
  .IsCreated()
  // This limits the action to only act on resources with the name "example-1".
  .WithName("example-1")
  // Mutate() is where we define the actual behavior of this action.
  .Mutate(request => {
    // The request object is a wrapper around the K8s resource that Pepr is acting on.
    request
      // Here we are adding a label to the ConfigMap.
      .SetLabel("pepr", "was-here")
      // And here we are adding an annotation.
      .SetAnnotation("pepr.dev", "annotations-work-too");

    // Note that we are not returning anything here. This is because Pepr is tracking the changes in each action automatically.
  });
```

---

In this example, a Validate action rejects any ConfigMap in the `pepr-demo` namespace that has no data.

```ts
When(a.ConfigMap)
  .IsCreated()
  .InNamespace("pepr-demo")
  // Validate() is where we define the actual behavior of this action.
  .Validate(request => {
    // If data exists, approve the request.
    if (request.Raw.data) {
      return request.Approve();
    }

    // Otherwise, reject the request with a message and optional code.
    return request.Deny("ConfigMap must have data");
  });
```

---

In this example, a Watch action on the name and phase of any ConfigMap.Watch actions run in a separate controller that tracks changes to resources, including existing resources so that you can react to changes in real-time. It is important to note that Watch actions are not run during the admission controller lifecycle, so they cannot be used to modify or validate resources. They also may run multiple times for the same resource, so it is important to make sure that your Watch actions are idempotent. In a future release, Pepr will provide a better way to control when a Watch action is run to avoid this issue.

```ts
When(a.ConfigMap)
  // Watch() is where we define the actual behavior of this action.
  .Watch((cm, phase) => {
    Log.info({cm}, `ConfigMap ${cm.metadata.name} was ${phase}`);
  });
```

There are many more examples in the `HelloPepr` capability that you can use as a reference when creating your own actions. Note that each time you run [`npx pepr update`](./010_pepr-cli.md#pepr-update), Pepr will automatically update the `HelloPepr` capability with the latest examples and best practices for you to reference and test directly in your Pepr Module.

---

In some scenarios involving Kubernetes Resource Controllers or Operator patterns, opting for a Reconcile action could be more fitting. Comparable to the Watch functionality, Reconcile is responsible for monitoring the name and phase of any Kubernetes Object. It operates within the Watch controller dedicated to observing modifications to resources, including those already existing, enabling responses to alterations as they occur. Unlike Watch, however, Reconcile employs a Queue to sequentially handle events once they are returned by the Kubernetes API. This allows the operator to handle bursts of events without overwhelming the system or the Kubernetes API. It provides a mechanism to back off when the system is under heavy load, enhancing overall stability and maintaining the state consistency of Kubernetes resources, as the order of operations can impact the final state of a resource.

```ts
When(WebApp)
  .IsCreatedOrUpdated()
  .Validate(validator)
  .Reconcile(async instance => {

    const { namespace, name, generation } = instance.metadata;

    if (!instance.metadata?.namespace) {
      Log.error({instance}, `Invalid WebApp definition`);
      return;
    }

    const isPending = instance.status?.phase === Phase.Pending;
    const isCurrentGeneration = generation === instance.status?.observedGeneration;

    if (isPending || isCurrentGeneration) {
      Log.debug({instance}, `Skipping pending or completed instance`);
      return;
    }

    Log.debug({instance}, `Processing instance ${namespace}/${name}`);


    try {
      // Set Status to pending
      await updateStatus(instance, { phase: Phase.Pending });

      // Deploy Deployment, ConfigMap, Service, ServiceAccount, and RBAC based on instance
      await Deploy(instance);

      // Set Status to ready
      await updateStatus(instance, {
        phase: Phase.Ready,
        observedGeneration: instance.metadata.generation,
      });
    } catch (e) {
      Log.error(e, `Error configuring for ${namespace}/${name}`);

      // Set Status to failed
      void updateStatus(instance, {
        phase: Phase.Failed,
        observedGeneration: instance.metadata.generation,
      });
    }
  });
```
