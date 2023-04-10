import { a } from "../../src/lib/k8s";
import { Capability } from "../../src/lib/capability";

export const TestMutations = new Capability({
  name: "test-mutations",
  description: "A collection of examples of data mutations.",
  namespaces: ["mutation-namespace"],
});

const { When } = TestMutations;

When(a.Deployment)
  .IsCreated()
  .ThenSet({
    spec: {
      minReadySeconds: 3,
    },
  });

When(a.Pod)
  .IsCreatedOrUpdated()
  .ThenSet({
    metadata: {
      labels: {
        "pepr.dev": "was-here",
      },
    },
    spec: {
      initContainers: [
        {
          name: "pepr-extra-spice",
          image: "nginx:1.19.1",
        },
      ],
    },
  })
  .Then(request => {
    request.Raw.spec.containers[3].image = "nginx:1.19.1";
  });

When(a.ConfigMap)
  .IsCreated()
  .Then(request => {
    request.Raw.data["test"] = "thing";
  });

When(a.StatefulSet)
  .IsCreated()
  .InNamespace("mutation-namespace")
  .Then(request => {
    request.Raw.spec.minReadySeconds = 10;
  })
  .Then(request => {
    request.Raw;
  });

When(a.CronJob)
  .IsCreated()
  .WithLabel("changeme", "true")
  .WithAnnotation("changeme", "true")
  .Then(request => {
    request.Raw.spec.schedule = "*/5 * * * *";
  });

When(a.Deployment)
  .IsCreatedOrUpdated()
  .InNamespace("ns1", "ns2")
  .Then(request => {
    request
      .SetLabel("mutated", "true")
      .SetLabel("test", "thing")
      .SetAnnotation("test2", "thing")
      .RemoveLabel("test3");

    if (request.HasLabel("test")) {
      request.SetLabel("test5", "thing");
    }

    const { spec } = request.Raw;
    spec.strategy.type = "Recreate";
    spec.minReadySeconds = 3;

    if (request.PermitSideEffects) {
      // Do side-effect inducing things
    }
  });

When(a.Service)
  .IsCreated()
  .Then(request => {
    request.SetLabel("mutated", "true").SetLabel("test", "thing").RemoveLabel("test3");
  });
