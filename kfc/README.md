# Kubernetes Fluent Client for Node

[![Npm package license](https://badgen.net/npm/license/kubernetes-fluent-client)](https://npmjs.com/package/kubernetes-fluent-client)
[![Known Vulnerabilities](https://snyk.io/test/npm/kubernetes-fluent-client/badge.svg)](https://snyk.io/advisor/npm-package/kubernetes-fluent-client)
[![Npm package version](https://badgen.net/npm/v/kubernetes-fluent-client)](https://npmjs.com/package/kubernetes-fluent-client)
[![Npm package total downloads](https://badgen.net/npm/dt/kubernetes-fluent-client)](https://npmjs.com/package/kubernetes-fluent-client)

The Kubernetes Fluent Client for Node is a fluent API for the [Kubernetes JavaScript Client](https://github.com/kubernetes-client/javascript) with some additional logic for [Server Side Apply](https://kubernetes.io/docs/reference/using-api/server-side-apply/), [Watch](https://kubernetes.io/docs/reference/using-api/api-concepts/#efficient-detection-of-changes) with retry/signal control, and [Field Selectors](https://kubernetes.io/docs/concepts/overview/working-with-objects/field-selectors/). In addition to providing a human-friendly API, it also provides a simple way to create and manage resources in the cluster and integrate with K8s in a type-safe way.

To install the Kubernetes Fluent Client, run the following command:

```bash
npm install kubernetes-fluent-client
```

See below for some example uses of the library.

```typescript
import { K8s, kind } from "kubernetes-fluent-client";

// Let's create a random namespace to work in
const namespace = "my-namespace" + Math.floor(Math.random() * 1000);

// This will be called after the resources are created in the cluster
async function demo() {
  // Now, we can use the fluent API to query for the resources we just created

  // You can use watch to monitor resources in the cluster and react to changes
  const watcher = K8s(kind.Pod).Watch((pod, phase) => {
    console.log(`Pod ${pod.metadata?.name} is ${phase}`);
  });

  // This will run until the process is terminated or the watch is aborted
  await watcher.start();

  // Let's abort the watch after 5 seconds
  setTimeout(watcher.close, 5 * 1000);

  // Passing the name to Get() will return a single resource
  const ns = await K8s(kind.Namespace).Get(namespace);
  console.log(ns);

  // This time we'll use the InNamespace() method to filter the results by namespace and name
  const cm = await K8s(kind.ConfigMap).InNamespace(namespace).Get("my-configmap");
  console.log(cm);

  // If we don't pass a name to Get(), we'll get a list of resources as KubernetesListObject
  // The matching resources will be in the items property
  const pods = await K8s(kind.Pod).InNamespace(namespace).Get();
  console.log(pods);

  // Now let's delete the resources we created, you can pass the name to Delete() or the resource itself
  await K8s(kind.Namespace).Delete(namespace);

  // Let's use the field selector to find all the running pods in the cluster
  const runningPods = await K8s(kind.Pod).WithField("status.phase", "Running").Get();
  runningPods.items.forEach(pod => {
    console.log(`${pod.metadata?.namespace}/${pod.metadata?.name} is running`);
  });

  // Get logs from a Deployment named "nginx" in the namespace
  const logs = await K8s(kind.Deployment).InNamespace(namespace).Logs("nginx");
  console.log(logs);
}

// Create a few resources to work with: Namespace, ConfigMap, and Pod
Promise.all([
  // Create the namespace
  K8s(kind.Namespace).Apply({
    metadata: {
      name: namespace,
    },
  }),

  // Create the ConfigMap in the namespace
  K8s(kind.ConfigMap).Apply({
    metadata: {
      name: "my-configmap",
      namespace,
    },
    data: {
      "my-key": "my-value",
    },
  }),

  // Create the Pod in the namespace
  K8s(kind.Pod).Apply({
    metadata: {
      name: "my-pod",
      namespace,
    },
    spec: {
      containers: [
        {
          name: "my-container",
          image: "nginx",
        },
      ],
    },
  }),
])
  .then(demo)
  .catch(err => {
    console.error(err);
  });
```

### Generating TypeScript Definitions from CRDs

The Kubernetes Fluent Client can generate TypeScript definitions from Custom Resource Definitions (CRDs) using the `generate` command. This command will generate TypeScript interfaces for the CRDs in the cluster and save them to a file.

To generate TypeScript definitions from CRDs, run the following command:

```bash
kubernetes-fluent-client crd /path/to/input.yaml /path/to/output/folder
```

If you have a CRD in a file named `crd.yaml` and you want to generate TypeScript definitions in a folder named `types`, you can run the following command:

```bash
kubernetes-fluent-client crd crd.yaml types
```

This will generate TypeScript interfaces for the CRD in the `crd.yaml` file and save them to the `types` folder.

By default, the generated TypeScript interfaces will be post-processed to make them more user-friendly. If you want to disable this post-processing, you can use the `--noPost` flag:

```bash
kubernetes-fluent-client crd crd.yaml types --noPost
```

### Community

To chat with other users & see some examples of the fluent client in active use, go to [Kubernetes Slack](https://communityinviter.com/apps/kubernetes/community) and join `#pepr` channel.
