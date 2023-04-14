import { Capability, a } from "pepr";

/**
 *  The HelloPepr Capability is an example capability to demonstrate some general concepts of Pepr.
 *  To test this capability you can run `pepr dev` or `npm start` and then run the following command:
 *  `kubectl apply -f capabilities/hello-pepr.samples.yaml`
 */
export const HelloPepr = new Capability({
  name: "hello-pepr",
  description: "A simple example capability to show how things work.",
  namespaces: ["pepr-demo"],
});

// Use the 'When' function to create a new Capability Action
const { When } = HelloPepr;

/**
 * This is a single Capability Action. They can be in the same file or imported from other files.
 * In this example, when a ConfigMap is created with the name `example-1`, we add a label and annotation.
 *
 * Equivalent to manually running:
 * `kubectl label configmap example-1 pepr=was-here`
 * `kubectl annotate configmap example-1 pepr.dev=annotations-work-too`
 */
When(a.ConfigMap)
  .IsCreated()
  .WithName("example-1")
  .Then(request => {
    request.SetLabel("pepr", "was-here").SetAnnotation("pepr.dev", "annotations-work-too");
  });

/**
 * This Capability Action does the exact same changes for example-2, except this time it uses the `.ThenSet()` feature.
 * You can stack multiple `.Then()` calls, but only a single `.ThenSet()`
 */
When(a.ConfigMap)
  .IsCreated()
  .WithName("example-2")
  .ThenSet({
    metadata: {
      labels: {
        pepr: "was-here",
      },
      annotations: {
        "pepr.dev": "annotations-work-too",
      },
    },
  });

/**
 * This Capability Action combines different styles. Unlike the previous actions, this one will look for any ConfigMap
 * in the `pepr-demo` namespace that has the label `change=by-label` during either CREATE or UPDATE. Note that all
 * conditions added such as `WithName()`, `WithLabel()`, `InNamespace()`, are ANDs so all conditions must be true
 * for the request to be processed.
 */
When(a.ConfigMap)
  .IsCreatedOrUpdated()
  .WithLabel("change", "by-label")
  .Then(request => {
    // The K8s object e are going to mutate
    const cm = request.Raw;

    // Get the username and uid of the K8s reuest
    const { username, uid } = request.Request.userInfo;

    // Store some data about the request in the configmap
    cm.data["username"] = username;
    cm.data["uid"] = uid;

    // You can still mix other ways of making changes too
    request.SetAnnotation("pepr.dev", "making-waves");
  });
