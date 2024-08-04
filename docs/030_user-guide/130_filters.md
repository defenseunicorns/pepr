# Pepr Filters

Filters are functions that take a `AdmissionReview` or Watch event and return a boolean. They are used to filter out resources that do not meet certain criteria. Filters are used in the package to filter out resources that are not relevant to the user-defined admission or watch process.

```ts
When(a.ConfigMap)
  // This limits the action to only act on new resources.
  .IsCreated()
  // Name filter
  .WithName("example-1")
  // Namespace filter
  .InNamespace("webapp")
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
- `.InNamespace("namespace")`: Filters resources by namespace.
- `.WithLabel("key", "value")`: Filters resources by label. (Can be multiple)
- `.WithDeletionTimestamp()`: Filters resources that have a deletion timestamp.
