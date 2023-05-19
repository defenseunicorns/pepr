# Pepr

<img align="right" width="40%" src=".images/pepr.png" />

Pepr is on a mission to save Kubernetes from the tyranny of YAML, intimidating glue code, bash scripts, and other makeshift solutions. As a Kubernetes controller, Pepr empowers you to define Kubernetes transformations using TypeScript, without software development expertise thanks to plain-english configurations. Pepr transforms a patchwork of forks, scripts, overlays, and other chaos into a cohesive, well-structured, and maintainable system. With Pepr, you can seamlessly transition IT ops tribal knowledge into code, simplifying documentation, testing, validation, and coordination of changes for a more predictable outcome.

## Features

- Zero-config K8s webhook mutations and [validations soon](https://github.com/defenseunicorns/pepr/issues/73).
- Human-readable fluent API for generating [Pepr Capabilities](#capability)
- Generate new K8s resources based off of cluster resource changes
- Perform other exec/API calls based off of cluster resources changes or any other arbitrary schedule
- Out of the box airgap support with [Zarf](https://zarf.dev)
- Entire NPM ecosystem available for advanced operations
- Realtime K8s debugging system for testing/reacting to cluster changes
- Controller network isolation and tamper-resistent module execution
- Automatic least-privilege RBAC generation [soon](https://github.com/defenseunicorns/pepr/issues/31)
- AMD64 and ARM64 support

## Example Pepr CapabilityAction

This quick sample shows how to react to a ConfigMap being created or updated in the cluster. It adds a label and annotation to the ConfigMap and adds some data to the ConfigMap. Finally, it logs a message to the Pepr controller logs. For more see [CapabilityActions](./docs/actions.md).

```ts
When(a.ConfigMap)
  .IsCreatedOrUpdated()
  .InNamespace("pepr-demo")
  .WithLabel("unicorn", "rainbow")
  .Then(request => {
    // Add a label and annotation to the ConfigMap
    request
      .SetLabel("pepr", "was-here")
      .SetAnnotation("pepr.dev", "annotations-work-too");

    // Add some data to the ConfigMap
    request.Raw.data["doug-says"] = "Pepr is awesome!";

    // Log a message to the Pepr controller logs
    Log.info("A 🦄 ConfigMap was created or updated:");
  });
```

## Wow too many words! tl;dr;

```bash
# Install Pepr (you can also use npx)
npm i -g pepr

# Initialize a new Pepr Module
pepr init

# Follow the prompts...

# If you already have a Kind or K3d cluster you want to use, skip this step
npm run k3d-setup

# Start playing with Pepr now
# If using another local K8s distro instead of k3d, run `pepr dev --host host.docker.internal`
pepr dev
kubectl apply -f capabilities/hello-pepr.samples.yaml

# Be amazed and ⭐️ this repo
```

Pepr is an open-source project that helps IT Ops teams of all skill levels manage and modify resources in a Kubernetes (K8s) cluster using TypeScript. Kubernetes simplifies the management of multiple computers working together to run and scale applications. Pepr acts as a smart assistant, automatically changing or validating parts of the system as needed.

TypeScript is used to create Pepr capabilities, benefiting from its error-catching and clean code features, but without requiring specialized software engineering experience or prior Typescript knowledge. Pepr also provides a user-friendly interface for writing commands in plain English in a [Fluent Interface](https://en.wikipedia.org/wiki/Fluent_interface) style.

Capabilities are logical groupings of actions, which are the atomic units of change within Pepr. Actions _modify_, _create_, or _interact_ with resources in response to events. Pepr's capabilities and actions work together in the cluster, offering a versatile and customizable tool that enhances Kubernetes by building glue code or plumbing for system interactions. This makes Pepr useful for various tasks such as creating robust policy engines or seamlessly connecting applications.

Imagine Pepr as a smart home system where different devices communicate with each other. Pepr provides instructions, simplifying the management of the smart home. The project enables both expert and novice capability authors to improve management and interactions within the Kubernetes environment, making its features accessible to everyone.

https://user-images.githubusercontent.com/882485/230895880-c5623077-f811-4870-bb9f-9bb8e5edc118.mp4

## Concepts

### Module

A module is the top-level collection of capabilities. It is a single, complete TypeScript project that includes an entry point to load all the configuration and capabilities, along with their CapabilityActions. During the Pepr build process, each module produces a unique Kubernetes MutatingWebhookConfiguration and ValidatingWebhookConfiguration, along with a secret containing the transpiled and compressed TypeScript code. The webhooks and secret are deployed into the Kubernetes cluster with their own isolated controller.

See [Module](./docs/module.md) for more details.

### Capability

A capability is set of related CapabilityActions that work together to achieve a specific transformation or operation on Kubernetes resources. Capabilities are user-defined and can include one or more CapabilityActions. They are defined within a Pepr module and can be used in both MutatingWebhookConfigurations and ValidatingWebhookConfigurations. A Capability can have a specific scope, such as mutating or validating, and can be reused in multiple Pepr modules.

See [Capabilities](./docs/capabilities.md) for more details.

### CapabilityAction

CapabilityAction is a discrete set of behaviors defined in a single function that acts on a given Kubernetes GroupVersionKind (GVK) passed in from Kubernetes. CapabilityActions are the atomic operations that are performed on Kubernetes resources by Pepr.

For example, a CapabilityAction could be responsible for adding a specific label to a Kubernetes resource, or for modifying a specific field in a resource's metadata. CapabilityActions can be grouped together within a Capability to provide a more comprehensive set of operations that can be performed on Kubernetes resources.

See [CapabilityActions](./docs/actions.md) for more details.

## Logical Pepr Flow
![Module Diagram](./.images/modules.svg)

## TypeScript

[TypeScript](https://www.typescriptlang.org/) is a strongly typed, object-oriented programming language built on top of JavaScript. It provides optional static typing and a rich type system, allowing developers to write more robust code. TypeScript is transpiled to JavaScript, enabling it to run in any environment that supports JavaScript. Pepr allows you to use JavaScript or TypeScript to write capabilities, but TypeScript is recommended for its type safety and rich type system. You can learn more about TypeScript [here](https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html).

## Kubernetes Mutating Webhooks

[Kubernetes mutating webhooks](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/) are a powerful feature that allows users to intercept and modify Kubernetes API requests, such as resource creation or updates, before they are persisted to the cluster. They can be used to enforce security policies, default values, or perform custom transformations on resources.

Pepr uses Kubernetes mutating webhooks to react to cluster resource events and apply user-defined capabilities, which are sets of Kubernetes transformations/actions.
