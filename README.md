# Pepr

Pepr is an open-source project licensed under the Apache 2 license, designed to be a declarative Kubernetes configuration system that automates application reconfiguration. It allows users to interact with user-defined "capabilities" that react to Kubernetes mutating webhook events.

## Features

- Define a set of Kubernetes transformations/actions as Pepr capabilities.
- Write capabilities in TypeScript and bundle them for in-cluster processing using [v8go](https://github.com/rogchap/v8go) and V8 isolates (cached for performance).
- React to cluster resources by mutating them, creating new Kubernetes resources, or performing arbitrary API calls.

## Example

Define a new capability:

```
pepr new hello-world -d demo
```

This will create a new directory tree called `demo/hello-world` with the following structure:

### demo/hello-world/default.ts

```typescript
import "./test-mutations";
```

### demo/hello-world/index.ts

```typescript
import { a } from "@k8s";
import { Capability } from "@pepr";

const { When } = new Capability({
  // The unique name of the capability
  name: "hello-world",
  // A short description of the capability
  description: "Type a useful description here 🦄",
  // Limit what namespaces the capability can be used in (optional)
  namespaces: [],
});
```

Next, we need to define some actions to perform when specific Kubernetes resources are created, updated or deleted in the cluster. Pepr provides a set of actions that can be used to react to Kubernetes resources, such as `a.Pod`, `a.Deployment`, `a.CronJob`, etc. These actions can be chained together to create complex conditions, such as `a.Pod.IsCreated().InNamespace("default")` or `a.Deployment.IsUpdated().WithLabel("changeme=true")`. Below is an example of a capability that reacts to the creation of a CronJob resource:

```typescript
When(a.CronJob).IsCreated().Then(modifyCronJobSchedule);

function modifyCronJobSchedule(cronJob: Action<CronJob>) {
  cronJob.Raw.spec.schedule = "*/5 * * * *";
}
```

Here's a more complex example that reacts to the creation of a Deployment resource:

```typescript
When(a.Deployment)
  .IsCreatedOrUpdated()
  .InNamespace("mutation-namespace")
  .WithLabel("changeme", "true")
  .Then(changeABunchOfDeploymentThings);

function changeABunchOfDeploymentThings(deployment: Action<Deployment>) {
  deployment
    .SetLabel("mutated", "true")
    .SetLabel("test", "thing")
    .SetAnnotation("test2", "thing")
    .RemoveLabel("test3");

  if (deployment.HasLabel("test")) {
    deployment.SetLabel("test5", "thing");
  }

  let { spec } = deployment.Raw;
  spec.strategy.type = "Recreate";
  spec.minReadySeconds = 3;

  if (deployment.PermitSideEffects) {
    // Do side-effect inducing things
  }
}
```

Now you can build and bundle your capability:

```
pepr build hello-world
```

## TypeScript

[TypeScript](https://www.typescriptlang.org/) is a strongly typed, object-oriented programming language built on top of JavaScript. It provides optional static typing and a rich type system, allowing developers to write more robust code. TypeScript is transpiled to JavaScript, enabling it to run in any environment that supports JavaScript. Pepr allows you to use JavaScript or TypeScript to write capabilities, but TypeScript is recommended for its type safety and rich type system. You can learn more about TypeScript [here](https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html).

## V8 and V8 Isolates

[V8](https://v8.dev/) is an open-source JavaScript engine developed by Google. It is responsible for running JavaScript code in Google Chrome and other web browsers based on the Chromium project. V8 is also used as the runtime for Node.js.

V8 Isolates are lightweight instances of the V8 engine that allow running multiple JavaScript contexts in parallel while maintaining isolation between them. Each isolate has its own memory heap and can execute JavaScript code independently, making them ideal for running untrusted code, parallelizing tasks, or sandboxing.

[v8go](https://github.com/rogchap/v8go) is a Go library that enables you to run JavaScript code using the V8 engine, leveraging the performance benefits of V8 Isolates. In Pepr, v8go is used to execute TypeScript code bundled for in-cluster processing.

## Kubernetes Mutating Webhooks

Kubernetes mutating webhooks are a powerful feature that allows users to intercept and modify Kubernetes API requests, such as resource creation or updates, before they are persisted to the cluster. They can be used to enforce security policies, default values, or perform custom transformations on resources.

Pepr uses Kubernetes mutating webhooks to react to cluster resource events and apply user-defined capabilities, which are sets of Kubernetes transformations/actions.
