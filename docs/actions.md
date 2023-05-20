# CapabilityActions

A CapabilityAction is a discrete set of behaviors defined in a single function that acts on a given Kubernetes GroupVersionKind (GVK) passed in from Kubernetes. CapabilityActions are the atomic operations that are performed on Kubernetes resources by Pepr.

For example, a CapabilityAction could be responsible for adding a specific label to a Kubernetes resource, or for modifying a specific field in a resource's metadata. CapabilityActions can be grouped together within a Capability to provide a more comprehensive set of operations that can be performed on Kubernetes resources.

Let's look at some example CapabilityActions that are included in the `HelloPepr` capability that is created for you when you [`pepr init`](./cli.md#pepr-init):

---

In this first example, Pepr is adding a label and annotation to a ConfigMap with tne name `example-1` when it is created. Comments are added to each line to explain in more detail what is happening.

```ts
// When(a.<Kind>) tells Pepr what K8s GroupVersionKind (GVK) this CapabilityAction should act on.
When(a.ConfigMap)
  // Next we tell Pepr to only act on new ConfigMaps that are created.
  .IsCreated()
  // Then we tell Pepr to only act on ConfigMaps with the name "example-1".
  .WithName("example-1")
  // Then() is where we define the actual behavior of this CapabilityAction.
  .Then(request => {
    // The request object is a wrapper around the K8s resource that Pepr is acting on.
    request
      // Here we are adding a label to the ConfigMap.
      .SetLabel("pepr", "was-here")
      // And here we are adding an annotation.
      .SetAnnotation("pepr.dev", "annotations-work-too");

    // Note that we are not returning anything here. This is because Pepr is tracking the changes in each CapabilityAction automatically.
  });
```

---

This example is identical to the previous one, except we are acting on a different ConfigMap name and using the `ThenSet()` shorthand to merge changes into the resource.

```ts
// Once again, we tell Pepr what K8s GVK this CapabilityAction should act on.
When(a.ConfigMap)
  // Next we tell Pepr to only act on new ConfigMaps that are created.
  .IsCreated()
  // This time we are acting on a ConfigMap with the name "example-2".
  .WithName("example-2")
  // Instead of using Then(), we are using ThenSet() to merge changes into the resource without a function call.
  .ThenSet({
    // Using Typescript, we will get intellisense for the ConfigMap object and immediate type-validation for the values we are setting.
    metadata: {
      labels: {
        pepr: "was-here",
      },
      annotations: {
        "pepr.dev": "annotations-work-too",
      },
    },
  });
```

There are many more examples in the `HelloPepr` capability that you can use as a reference when creating your own CapabilityActions. Note that each time you run [`pepr update`](./cli.md#pepr-update), Pepr will automatically update the `HelloPepr` capability with the latest examples and best practices for you to reference and test directly in your Pepr Module.
