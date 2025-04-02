# Validate

After the Mutation phase comes the Validation phase where the validating admission webhooks are invoked and can reject requests to enforce custom policies.

Validate does not annotate the objects that are allowed into the cluster, but the validation webhook can be audited with `npx pepr monitor`. Read the [monitoring docs](https://docs.pepr.dev/main/best-practices/#monitoring) for more information.

## Basic Validation

Validation actions can either approve or deny requests:

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

## Validation with Warnings

Pepr supports including warning messages in both approval and denial responses. Warnings provide a way to communicate important information to users without necessarily blocking their requests.

### Approving with Warnings

```ts
When(a.ConfigMap)
  .IsCreatedOrUpdated()
  .InNamespace("pepr-demo")
  .Validate(request => {
    const warnings = [];

    // Check for deprecated fields
    if (request.Raw.data && request.Raw.data["deprecated-field"]) {
      warnings.push("Warning: The 'deprecated-field' is being used and will be removed in future versions");
    }

    // Check for missing app label
    if (!request.HasLabel("app")) {
      warnings.push("Warning: Best practice is to include an 'app' label for resource identification");
    }

    // Return approval with warnings if any were generated
    return request.Approve(warnings.length > 0 ? warnings : undefined);
  });
```

### Denying with Warnings

```ts
When(a.ConfigMap)
  .IsCreatedOrUpdated()
  .InNamespace("pepr-demo")
  .Validate(request => {
    // Check for dangerous settings
    if (request.Raw.data && request.Raw.data["dangerous-setting"] === "true") {
      const warnings = [
        "Warning: The 'dangerous-setting' field is set to 'true'",
        "Consider using a safer configuration option"
      ];
      
      return request.Deny(
        "ConfigMap contains dangerous settings that are not allowed",
        422,
        warnings
      );
    }
    
    return request.Approve();
  });
```

Warnings will be included in the Kubernetes API response and can be displayed to users by `kubectl` and other Kubernetes clients, providing helpful feedback while still enforcing policies.
