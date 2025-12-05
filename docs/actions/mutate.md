# Mutate

Mutating admission webhooks are invoked first and can modify objects sent to the API server to enforce custom defaults. After an object is sent to Pepr's Mutating Admission Webhook, Pepr will [annotate the object](https://github.com/defenseunicorns/pepr/blob/f01f5eeda16c13ecd0d51b26b8a16ed7e4c1b080/src/lib/mutate-processor.ts#L64) to indicate the status.

After a successful mutation of an object in a module with UUID static-test, and capability name hello-pepr, expect to see this annotation: `static-test.pepr.dev/hello-pepr: succeeded`.

## Mutate Helpers

### `SetLabel`

`SetLabel` is used to set a label on a Kubernetes object as part of a Pepr Mutate action.

For example, to add a label when a ConfigMap is created:

```typescript
When(a.ConfigMap)
  .IsCreated()
  .Mutate(request => {
    request
      // Here we are adding a label to the ConfigMap.
      .SetLabel("pepr", "was-here")

    // Note that we are not returning anything here. This is because Pepr is tracking the changes in each action automatically.
  });
```

### `RemoveLabel`

`RemoveLabel` is used to remove a label on a Kubernetes object as part of a Pepr Mutate action.

For example, to remove a label when a ConfigMap is updated:

```typescript
When(a.ConfigMap)
  .IsCreated()
  .Mutate(request => {
    request
      // Here we are removing a label from the ConfigMap.
      .RemoveLabel("remove-me")

    // Note that we are not returning anything here. This is because Pepr is tracking the changes in each action automatically.
  });
```

### `SetAnnotation`

`SetAnnotation` is used to set an annotation on a Kubernetes object as part of a Pepr Mutate action.

For example, to add an annotation when a ConfigMap is created:

```typescript
When(a.ConfigMap)
  .IsCreated()
  .Mutate(request => {
    request
      // Here we are adding an annotation to the ConfigMap.
      .SetAnnotation("pepr.dev", "annotations-work-too");

    // Note that we are not returning anything here. This is because Pepr is tracking the changes in each action automatically.
  });
```

### `RemoveAnnotation`

`RemoveAnnotation` is used to remove an annotation on a Kubernetes object as part of a Pepr Mutate action.

For example, to remove an annotation when a ConfigMap is updated:

```typescript
When(a.ConfigMap)
  .IsUpdated()
  .Mutate(request => {
    request
      // Here we are removing an annotation from the ConfigMap.
      .RemoveAnnotation("remove-me");

    // Note that we are not returning anything here. This is because Pepr is tracking the changes in each action automatically.
  });
```

## See Also

Looking for some more generic helpers? Check out the [Module Author SDK](/user-guide/sdk) for information on other things that Pepr can help with.
