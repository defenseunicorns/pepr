# Frequently Asked Questions


## How do I remove the punycode warning?

By default, warnings are removed. You can allow warnings by setting the `PEPR_NODE_WARNINGS` environment variable.

```bash
PEPR_NODE_WARNINGS="true"
```

If you allow warnings, you can disable the specific punycode warning by:

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
* **Admission Webhooks and Kubernetes Controllers**: Both support building admission and Kubernetes controllers by reacting to changes in the cluster in an automated way.

Differences:
* **Main Goals**: Operator SDK is mainly focused on building operators and later included support for Webhooks. In contrast, Pepr started out as a framework for building Webhooks and later added support for building operators via [Kubernetes-Fluent-Client](https://github.com/defenseunicorns/kubernetes-fluent-client) through [Watch](../030_user-guide/030_actions/040_watch.md) and [Reconcile](../030_user-guide/030_actions/030_reconcile.md).
* **Language Support**: Operator SDK supports Go, Ansible, and Helm, while Pepr is written in TypeScript and designed with an English style fluent API for simplicity.
* **Lifecycle Management**: Operator SDK provides tools for managing the lifecycle of operators through OLM (Operator Lifecycle Manager), while Pepr relies on [Helm](../030_user-guide/120_customization.md) for upgrades.
* **Complexity**: Operator SDK uses native Kubernetes Go libraries for deep integration with Kubernetes resources, while Pepr exposes a high-level abstraction allowing users to focus on business logic.
* **Easy Setup**: While both make it easy to initialize a new project, Pepr comes with an out-of-the-box `hello-pepr.ts` example which demonstrates how to use Pepr effectively.

## How does Pepr compare to Kyverno?

Although Pepr and Kyverno have similarities, Pepr is very different than Kyverno. They have very different mission statements. Pepr focuses on making operators as easy as possible. Kyverno focuses on reporting, not building operators.

Similarities:

* Both have Mutating Webhooks that can dynamically change resources before admission
* Both have Validating Webhooks to configure what can/cannot go through admission
* Both provide a way to react to changes to pre-existing cluster resources (i.e., resources that have already gone through admission)

Differences:

* Pepr is more like a "framework" than a tool. In Pepr you create a Pepr [Module](../030_user-guide/020_pepr-modules.md). In the Pepr module you define [capabilities](../030_user-guide/040_capabilities.md) that enforce / apply desired cluster state.
* Pepr is written in TypeScript. Kyverno is written in Go.
* Pepr provides the flexibility of a full-fledged, strongly typed programming language to decide what decisions to make based on events happening in the cluster. With Kyverno, you are limited to the constraints of YAML.
* Pepr can be used to reconcile events in order, similar to Kube-Builder or Operator SDK.
* Pepr can apply a CustomResourceDefinition and control cluster state based on that custom resource.

Both Pepr and Kyverno are great tools. Which one to use for your project depends on your use case.

## How do I add custom labels to Pepr's Kubernetes manifests?

During the build process, custom labels can be added the `pepr-system` namespace based on the `package.json`. Checkout the [Customizing with package.json](../030_user-guide/120_customization.md#packagejson-configurations-table).

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
