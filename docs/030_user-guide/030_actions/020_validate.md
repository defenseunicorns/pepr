# Validate

After the Mutation phase, after all object modifications are complete, and after the incoming object is validated by the API server, validating admission webhooks are invoked and can reject requests to enforce custom policies.

Validate does not annotate the objects that are allowed into the cluster, but the validation webhook can be audited with `npx pepr monitor`. Read the [monitoring docs](https://docs.pepr.dev/main/best-practices/#monitoring) for more information.
