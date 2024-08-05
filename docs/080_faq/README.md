# Frequently Asked Questions


## How do I remove the punycode warning?

```bash
export NODE_OPTIONS="--disable-warning=DEP0040"
```

or 

```bash
npx --node-options="--disable-warning=DEP0040" pepr [command]
```

## How does Pepr compare to Operator SDK?

Pepr and Operator SDK are both frameworks used for building Kubernetes operators and admission controllers. While they share a common goal of simplifying the creation of Kubernetes operators and enhancing Kubernetes functionality, they have different approaches and features.

Similarities:
* **Scaffolding**: Automatically generate boilerplate code for new operators and Kubernetes manifests for building controllers.
* **Helper Functions**: Provide utility functions to interact with Kubernetes resources and manage the lifecycle of Kubernetes resources.
* **Admission Webhooks and Kubernetes Controllers**: Both support building admission controllers and Kubernetes controllers, utilizing Kubernetes Informer patterns.

Differences:
* **Main Goals**: Operator SDK is mainly focused on building operators and later included support for Webhooks. In contrast, Pepr started out as a framework for building Webhooks and later added support for building operators via the Kubernetes Informer in the [Kubernetes-Fluent-Client](https://github.com/defenseunicorns/kubernetes-fluent-client) through [Watch](../030_user-guide/030_actions/040_watch.md) and [Reconcile](.../030_user-guide/030_actions/030_reconcile.md).
* **Language Support**: Operator SDK supports Go, Ansible, and Helm, while Pepr is written in TypeScript and designed for a English style fluent API for simplicity.
* **Lifecycle Management**: Operator SDK provides tools for managing the lifecycle of operators through OLM (Operator Lifecycle Manager), while Pepr relies on [Helm](https://docs.pepr.dev/main/user-guide/customization/#customizing-with-helm) for upgrades.
* **Complexity**: Operator SDK uses native Kubernetes Go libraries for deep integration with Kubernetes resources, while Pepr keeps a high-level abstraction for simplicity allowing users to focus on business logic without the need to understand the Go Kubernetes libraries.
* **Lightweight**: Pepr is designed to be lightweight. The [modules](https://docs.pepr.dev/main/user-guide/pepr-modules/) are stored as secrets and mounted into the pod, reducing the size of the image.
* **Easy Setup**: While both are easy to initialize a new project, Pepr comes out-of-the-box example with `hello-pepr.ts`, demonstrating how to use Pepr effectively.
* **API Design**: Pepr uses an English-style fluent API for simplicity, whereas Operator SDK employs Go for its API. Pepr is designed to facilitate quick development and deployment of Kubernetes operators and admission controllers with minimal effort.


## How do I add custom labels to Pepr's Kubernetes manifests?

During the build process, custom labels can be added the Kubernetes manifests that Pepr generates based on the Pepr section of the `package.json`. Currently, adding custom labels to `namespace` is supported.  

The following example shows how to add custom namespace labels.  

```json
  "pepr": {
    "name": "new-release",
    ...
    "customLabels": {
      "namespace": {
        "istio-injection": "enabled",
        "app.kubernetes.io/name": "new-release"
      }
    },
    ...
  }
```

The resulting namespace will be generated after `npx pepr build`.  

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: pepr-system
  labels:
    istio-injection: enabled
    app.kubernetes.io/name: new-release
```

## My Pepr version is not the latest

If you notice your Pepr version does not correspond to the latest release in GitHub after doing `npx pepr -V`, clearing the NPX cache can often resolve the issue.

Run the cache clearing command

```bash
npx clear-npx-cache
```

If you want to ensure the cache has been cleared, you can check the cache directory. The location of this directory varies based on your operating system and configuration. However, you can generally find it in your system's home directory under `.npm`.

**Note** - If you are inside of the Pepr Core repo (https://github.com/defenseunicorns/pepr), then it is normal for `npx pepr -V` to return `0.0.0-development`.  

## I've found a bug, what should I do?

Please report it by opening an issue in the [Pepr GitHub repository](https://github.com/defenseunicorns/pepr/issues). Please include as much information as possible in your bug report, including:

* The version of Pepr you are using
* The version of Kubernetes you are using

## I've found a security issue, what should I do?

Security issues should be reported privately, via [email](mailto:pepr@defenseunicorns.com). You should receive a response within 24 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

## I have a feature request, what should I do?

Please let us know by opening an issue in the [Pepr GitHub repository](https://github.com/defenseunicorns/pepr/issues).

## How do I get help with Pepr?

If you have a question about Pepr, please open an issue in the [Pepr GitHub repository](https://github.com/defenseunicorns/pepr/issues) or contact us through the Pepr channel on the Kubernetes Slack.
