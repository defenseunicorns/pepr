import { a, use as handle } from "@k8s";
import { Capability } from "@pepr";

const { When, Register } = new Capability({
  name: "test-mutations",
  description: "A collection of examples of data mutations.",
  namespaces: ["mutation-namespace"],
});

export default Register;

When(a.StatefulSet)
  .IsCreated()
  .InNamespace("mutation-namespace")
  .Then<handle.StatefulSet>(request => {
    request.Raw.spec.minReadySeconds = 10;
  });

When(a.CronJob)
  .IsCreated()
  .WithLabel("changeme", "true")
  .WithAnnotation("changeme", "true")
  .Then<handle.CronJob>(request => {
    request.Raw.spec.schedule = "*/5 * * * *";
  });

When(a.Deployment)
  .IsCreatedOrUpdated()
  .InOneOfNamespaces("ns1", "ns2")
  .Then<handle.Deployment>(request => {
    request
      .SetLabel("mutated", "true")
      .SetLabel("test", "thing")
      .SetAnnotation("test2", "thing")
      .RemoveLabel("test3");

    if (request.HasLabel("test")) {
      request.SetLabel("test5", "thing");
    }

    let { spec } = request.Raw;
    spec.strategy.type = "Recreate";
    spec.minReadySeconds = 3;

    if (request.PermitSideEffects) {
      // Do side-effect inducing things
    }
  });

When(a.Service)
  .IsCreated()
  .Then<handle.Service>(request => {
    request
      .SetLabel("mutated", "true")
      .SetLabel("test", "thing")
      .RemoveLabel("test3");
  });
