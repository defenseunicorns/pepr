import { Capability } from "../../src/lib/capability";
import { a } from "../../src/lib/k8s";

/**
 * A collection of examples of data mutations.
 */
export const TestMutations = new Capability({
  name: "test-mutations",
  description: "A collection of examples of data mutations.",
  namespaces: ["mutation-namespace"],
});

const { When } = TestMutations;

/**
 * Set minReadySeconds to 3 when a Deployment is created.
 */
When(a.Deployment)
  .IsCreated()
  .ThenSet({
    spec: {
      minReadySeconds: 3,
    },
  });

/**
 * Add label and init container to a Pod when it is created or updated.
 */
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

/**
 * Add data to a ConfigMap when it is created.
 */
When(a.ConfigMap)
  .IsCreated()
  .Then(request => {
    request.Raw.data["test"] = "thing";
  });

/**
 * Set minReadySeconds to 10 when a StatefulSet is created.
 */
When(a.StatefulSet)
  .IsCreated()
  .InNamespace("mutation-namespace")
  .Then(request => {
    request.Raw.spec.minReadySeconds = 10;
  });

/**
 * Set schedule to "*/5 * * * *" when a CronJob is created with the label and annotation "changeme" set to "true".
 */
When(a.CronJob)
  .IsCreated()
  .WithLabel("changeme", "true")
  .WithAnnotation("changeme", "true")
  .Then(request => {
    request.Raw.spec.schedule = "*/5 * * * *";
  });

/**
 * Add and remove labels and annotations, set strategy type to "Recreate", and set minReadySeconds to 3 when a Deployment is created or updated in namespaces "ns1" or "ns2".
 */
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

/**
 * Add and remove labels from a Service when it is created.
 */
When(a.Service)
  .IsCreated()
  .Then(request => {
    request.SetLabel("mutated", "true").SetLabel("test", "thing").RemoveLabel("test3");
  });