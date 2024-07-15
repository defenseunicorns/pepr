# Frequently Asked Questions


## How do I remove the punycode warning?

```bash
export NODE_OPTIONS="--disable-warning=DEP0040"
```

or 

```bash
npx --node-options="--disable-warning=DEP0040" pepr [command]
```


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
