---
title: Concepts
linkTitle: Concepts
---

# Pepr Module

Each Pepr Module is it's own Typescript project, produced by [`pepr init`](./cli.md#pepr-init). Typically a module is maintained by a unique group or system. For example, a module for internal [Zarf](https://zarf.dev/) mutations would be different from a module for [Big Bang](https://p1.dso.mil/products/big-bang). An important idea with modules is that they are _wholly independent of one another_. This means that 2 different modules can be on completely different versions of Pepr and any other dependencies; their only interaction is through the standard K8s interfaces like any other webhook or controller.

## Module development lifecycle

1. **Create the module**:

   Use [`pepr init`](./cli.md#pepr-init) to generate a new module.

1. **Quickly validate system setup**:

   Every new module includes a sample Pepr Capability called `HelloPepr`. By default,
   this capability is deployed and monitoring the `pepr-demo` namespace. There is a sample
   yaml also included you can use to see Pepr in your cluster. Here's the quick steps to do
   that after `pepr init`:

   ```bash
   # cd to the newly-created Pepr module folder
   cd my-module-name

   # If you don't already have a local K8s cluster, you can set one up with k3d
   npm run k3d-setup

   # Launch pepr dev mode
   # If using another local K8s distro instead of k3d, use `pepr dev --host host.docker.internal`
   pepr dev

   # From another terminal, apply the sample yaml
   kubectl apply -f capabilities/hello-pepr.samples.yaml

   # Verify the configmaps were transformed using kubectl, k9s or another tool
   ```

1. **Create your custom Pepr Capabilities**

   Now that you have confirmed Pepr is working, you can now create new [capabilities](./capabilities.md). You'll also want to disable the `HelloPepr` capability in your module (`pepr.ts`) before pushing to production. You can disable by commenting out or deleting the `HelloPepr` variable below:

   ```typescript
   new PeprModule(cfg, [
     // Remove or comment the line below to disable the HelloPepr capability
     HelloPepr,

     // Your additional capabilities go here
   ]);
   ```

   _Note: if you also delete the `capabilities/hello-pepr.ts` file, it will be added again on the next [`pepr update`](./cli.md#pepr-update) so you have the latest examples usages from the Pepr SDK. Therefore, it is sufficient to remove the entry from your `pepr.ts` module
   config._

1. **Build and deploy the Pepr Module**

   Most of the time, you'll likely be iterating on a module with `pepr dev` for real-time feedback and validation Once you are ready to move beyond the local dev environment, Pepr provides deployment and build tools you can use.

   `pepr deploy` - you can use this command to build your module and deploy it into any K8s cluster your current `kubecontext` has access to. This setup is ideal for CI systems during testing, but is not recommended for production use. See [`pepr deploy`](./cli.md#pepr-deploy) for more info.

## Advanced Module Configuration

By default, when you run `pepr init`, the module is not configured with any additional options. Currently, there are 3 options you can configure:

- `deferStart` - if set to `true`, the module will not start automatically. You will need to call `start()` manually. This is useful if you want to do some additional setup before the module controller starts. You can also use this to change the default port that the controller listens on.

- `beforeHook` - an optional callback that will be called before every request is processed. This is useful if you want to do some additional logging or validation before the request is processed.

- `afterHook` - an optional callback that will be called after every request is processed. This is useful if you want to do some additional logging or validation after the request is processed.

You can configure each of these by modifying the `pepr.ts` file in your module. Here's an example of how you would configure each of these options:

```typescript
const module = new PeprModule(
  cfg,
  [
    // Your capabilities go here
  ],
  {
    deferStart: true,

    beforeHook: req => {
      // Any actions you want to perform before the request is processed, including modifying the request.
    },

    afterHook: res => {
      // Any actions you want to perform after the request is processed, including modifying the response.
    },
  }
);

// Do any additional setup before starting the controller
module.start();
```

# Capabilities

A capability is set of related [actions](./actions.md) that work together to achieve a specific transformation or operation on Kubernetes resources. Capabilities are user-defined and can include one or more actions. They are defined within a Pepr module and can be used in both MutatingWebhookConfigurations and ValidatingWebhookConfigurations. A Capability can have a specific scope, such as mutating or validating, and can be reused in multiple Pepr modules.

When you [`pepr init`](./cli.md#pepr-init), a `capabilities` directory is created for you. This directory is where you will define your capabilities. You can create as many capabilities as you need, and each capability can contain one or more actions. Pepr also automatically creates a `HelloPepr` capability with a number of example actions to help you get started.

## Creating a Capability

Define a new capability can be done via a [VSCode Snippet](https://code.visualstudio.com/docs/editor/userdefinedsnippets) generated during [`pepr init`](./cli.md#pepr-init).

1. Create a new file in the `capabilities` directory with the name of your capability. For example, `capabilities/my-capability.ts`.

1. Open the new file in VSCode and type `create` in the file. A suggestion should prompt you to generate the content from there.

https://user-images.githubusercontent.com/882485/230897379-0bb57dff-9832-479f-8733-79e103703135.mp4

_If you prefer not to use VSCode, you can also modify or copy the `HelloPepr` capability to meet your needs instead._


## Reusable Capabilities

Pepr has an NPM org managed by Defense Unicorns, `@pepr`, where capabilities are published for reuse in other Pepr Modules. You can find a list of published capabilities [here](https://www.npmjs.com/search?q=@pepr). You can also publish your own Pepr capabilities to NPM and import them.  A couple of things you'll want to be aware of:

- Reuseable capability versions should use the format `0.x.x` or `0.12.x` as examples to determine compatibility with other reusable capabilities. Before `1.x.x`, we recommend binding to `0.x.x` if you can for maximum compatibility.

- `pepr.ts` will still be used for local development, but you'll need to also publish an `index.ts` that exports your capabilities. When you build & publish the capability to NPM, you can use `npx pepr build -e index.ts` to generate the code needed for reuse by other Pepr modules.

- See [Pepr Istio](https://github.com/defenseunicorns/pepr-istio) for an example of a reusable capability.


# Actions

An action is a discrete set of behaviors defined in a single function that acts on a given Kubernetes GroupVersionKind (GVK) passed in during the admission controller lifecycle. Actions are the atomic operations that are performed on Kubernetes resources by Pepr.

For example, an action could be responsible for adding a specific label to a Kubernetes resource, or for modifying a specific field in a resource's metadata. Actions can be grouped together within a Capability to provide a more comprehensive set of operations that can be performed on Kubernetes resources.

Actions are `Mutate()`, `Validate()`, or `Watch()`. Both Mutate and Validate actions run during the admission controller lifecycle, while Watch actions run in a separate controller that tracks changes to resources, including existing resources.

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

In this example, a Watch action on the name and phase of any ConfigMap.Watch actions run in a separate controller that tracks changes to resources, including existing resources so that you can react to changes in real-time. It is important to note that Watch actions are not run during the admission controller lifecycle, so they cannot be used to modify or validate resources. They also may run multiple times for the same resource, so it is important to make sure that your Watch actions are idempotent. In a future release, Pepr will provide a better way to control when a Watch action is run to avoid this issue.

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

# Pepr Store: A Lightweight Key-Value Store for Pepr Modules

The nature of admission controllers and general watch operations (the `Mutate`, `Validate` and `Watch` actions in Pepr) make some types of complex and long-running operations difficult. There are also times when you need to share data between different actions. While you could manually create your own K8s resources and manage their cleanup, this can be very hard to track and keep performant at scale. 

The Pepr Store solves this by exposing a simple, [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Storage)-compatible mechanism for use within capabilities. Additionally, as Pepr runs multiple replicas of the admission controller along with a watch controller, the Pepr Store provides a unique way to share data between these different instances automatically.

Each Pepr Capability has a `Store` instance that can be used to get, set and delete data as well as subscribe to any changes to the Store. Behind the scenes, all capability store instances in a single Pepr Module are stored within a single CRD in the cluster. This CRD is automatically created when the Pepr Module is deployed. Care is taken to make the read and write operations as efficient as possible by using K8s watches, batch processing and patch operations for writes.

## Key Features

- **Asynchronous Key-Value Store**: Provides an asynchronous interface for storing small amounts of data, making it ideal for sharing information between various actions and capabilities.
- **Web Storage API Compatibility**: The store's API is aligned with the standard [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Storage), simplifying the learning curve.
- **Real-time Updates**: The `.subscribe()` and `onReady()` methods enable real-time updates, allowing you to react to changes in the data store instantaneously.

- **Automatic CRD Management**: Each Pepr Module has its data stored within a single Custom Resource Definition (CRD) that is automatically created upon deployment.
- **Efficient Operations**: Pepr Store uses Kubernetes watches, batch processing, and patch operations to make read and write operations as efficient as possible.

## Quick Start

```typescript
// Example usage for Pepr Store
Store.setItem("example-1", "was-here");
Store.setItem("example-1-data", JSON.stringify(request.Raw.data));
Store.onReady(data => {
  Log.info(data, "Pepr Store Ready");
});
const unsubscribe = Store.subscribe(data => {
  Log.info(data, "Pepr Store Updated");
  unsubscribe();
});
```

## API Reference

### Methods

- `getItem(key: string)`: Retrieves a value by its key. Returns `null` if the key doesn't exist.
- `setItem(key: string, value: string)`: Sets a value for a given key. Creates a new key-value pair if the key doesn't exist.
- `removeItem(key: string)`: Deletes a key-value pair by its key.
- `clear()`: Clears all key-value pairs from the store.
- `subscribe(listener: DataReceiver)`: Subscribes to store updates.
- `onReady(callback: DataReceiver)`: Executes a callback when the store is ready.
