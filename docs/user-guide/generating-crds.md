# Generating CRDs

Pepr comes with the ability to generate Kubernetes Custom Resource Definitions (CRDs) from TypeScript types. This feature is particularly useful for operator developers who are creating Operators that utilize CRDs.

To generate a TypeScript types for a CRD, you can use the `pepr crd create` command. This command allows you to specify the group, version, kind, short name, plural name, and scope of the CRD.

```bash
npx pepr crd create \
  --group cache \
  --version v1alpha1 \
  --kind Memcache \
  --short-name mc \
  --plural memcaches \
  --scope Namespaced
```

This command will create a TypeScript file in the `crds` directory with the generated types for the specified CRD. The generated file will include the necessary type definitions for the CRD.

> [!NOTE]
> The comments in the interface spec and condition type become descriptions for the CRD properties.
> You can add comments to your properties to provide additional context or documentation for the generated types.

After adding the required types for your CRD, you can then generate the CRD YAML file using the `pepr crd generate` command. This command will create a YAML file that defines the CRD in Kubernetes format.

```bash
npx pepr crd generate
```

You can control the output directory for the generated CRD YAML file by using the `--output` option. If not, it will be generated in the crds directory by default.

At this point, you can apply the generated CRD to your Kubernetes cluster using `kubectl apply -f crds/your-crd-file.yaml`.

```bash
> kubectl apply -f crds
customresourcedefinition.apiextensions.k8s.io/memcaches.cache.pepr.dev created
```
