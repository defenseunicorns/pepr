# Actions

An action is a discrete set of behaviors defined in a single function that acts on a given Kubernetes GroupVersionKind (GVK) passed in during the admission controller lifecycle. Actions are the atomic operations that are performed on Kubernetes resources by Pepr.

For example, an action could be responsible for adding a specific label to a Kubernetes resource, or for modifying a specific field in a resource's metadata. Actions can be grouped together within a Capability to provide a more comprehensive set of operations that can be performed on Kubernetes resources.

Actions are `Mutate()`, `Validate()`, or `Watch()` actions. Both Mutate and Validate actions run during the admission controller lifecycle, while Watch actions run in a separate controller that watches for changes to resources, including existing resources.

Let's look at some example actions that are included in the `HelloPepr` capability that is created for you when you [`pepr init`](./cli.md#pepr-init):

---

In this first example, Pepr is adding a label and annotation to a ConfigMap with tne name `example-1` when it is created. Comments are added to each line to explain in more detail what is happening.

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

In this example, a Watch action the name and phase of any ConfigMap.

```ts
When(a.ConfigMap)
  // Watch() is where we define the actual behavior of this action.
  .Watch((cm, phase) => {
    Log.info(cm, `ConfigMap ${cm.metadata.name} was ${phase}`);
  });
```

```
There are many more examples in the `HelloPepr` capability that you can use as a reference when creating your own actions. Note that each time you run [`pepr update`](./cli.md#pepr-update), Pepr will automatically update the `HelloPepr` capability with the latest examples and best practices for you to reference and test directly in your Pepr Module.
```
