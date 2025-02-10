# Pepr Filters

Filters are functions that take a `AdmissionReview` or Watch event and return a boolean. They are used to filter out resources that do not meet certain criteria. Filters are used in the package to filter out resources that are not relevant to the user-defined admission or watch process.

```ts
When(a.ConfigMap)
  // This limits the action to only act on new resources.
  .IsCreated()
  // Namespace filter
  .InNamespace("webapp")
  // Name filter
  .WithName("example-1")
  // Label filter
  .WithLabel("app", "webapp")
  .WithLabel("env", "prod")
  .Mutate(request => {
    request
      .SetLabel("pepr", "was-here")
      .SetAnnotation("pepr.dev", "annotations-work-too");
  });
```

## `Filters`

- `.WithName("name")`: Filters resources by name.
- `.WithNameRegex(/^pepr/)`: Filters resources by name using a regex.
- `.InNamespace("namespace")`: Filters resources by namespace.
- `.InNamespaceRegex(/(.*)-system/)`: Filters resources by namespace using a regex.
- `.WithLabel("key", "value")`: Filters resources by label. (Can be multiple)
- `.WithDeletionTimestamp()`: Filters resources that have a deletion timestamp.

Notes:

- `WithDeletionTimestamp()` is does not work on Delete through the `Mutate` or `Validate` methods because the Kubernetes Admission Process does not fire the DELETE event with a deletion timestamp on the resource.
- `WithDeletionTimestamp()` _will_ match on an Update event during Admission (`Mutate` or `Validate`) when pending-deletion permitted changes (like removing a finalizer) occur.
