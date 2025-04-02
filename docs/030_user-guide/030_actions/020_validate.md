# Validate

After the Mutation phase comes the Validation phase where the validating admission webhooks are invoked and can reject requests to enforce custom policies.

Validate does not annotate the objects that are allowed into the cluster, but the validation webhook can be audited with `npx pepr monitor`. Read the [monitoring docs](https://docs.pepr.dev/main/best-practices/#monitoring) for more information.

```ts
When(a.ConfigMap)
  .IsCreated()
  .Validate(request => {
    if (request.HasAnnotation("evil")) {
      return request.Deny("No evil CM annotations allowed.", 400);
    }

    return request.Approve();
  });
```
