# Mutate

Mutating admission webhooks are invoked first and can modify objects sent to the API server to enforce custom defaults. After an object is sent to Pepr's Mutating Admission Webhook, Pepr will [annotate the object](https://github.com/defenseunicorns/pepr/blob/f01f5eeda16c13ecd0d51b26b8a16ed7e4c1b080/src/lib/mutate-processor.ts#L64) to indicate the status.

After a successful mutation of an object in a module with UUID static-test, and capability name hello-pepr, expect to see this annotation: `static-test.pepr.dev/hello-pepr: succeeded`.

## Mutate Helpers

### SetLabel

### SetAnnotation

### RemoveAnnotation

### RemoveLabel

## See Also

See also [SDK](../130_sdk.md) for information on the Pepr SDK.