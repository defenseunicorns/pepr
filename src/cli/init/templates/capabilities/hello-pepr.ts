import {
  Capability,
  PeprRequest,
  RegisterKind,
  a,
  fetch,
  fetchStatus,
} from "pepr";

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
 * ---------------------------------------------------------------------------------------------------
 *                                   CAPABILITY ACTION (Namespace)                                   *
 * ---------------------------------------------------------------------------------------------------
 *
 * This Capability Action removes the label `remove-me` when a Namespace is created.
 * Note we don't need to specify the namespace here, because we've already specified
 * it in the Capability definition above.
 */
When(a.Namespace)
  .IsCreated()
  .Then(ns => ns.RemoveLabel("remove-me"));

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   CAPABILITY ACTION (CM Example 1)                                *
 * ---------------------------------------------------------------------------------------------------
 *
 * This is a single Capability Action. They can be in the same file or put imported from other files.
 * In this example, when a ConfigMap is created with the name `example-1`, then add a label and annotation.
 *
 * Equivalent to manually running:
 * `kubectl label configmap example-1 pepr=was-here`
 * `kubectl annotate configmap example-1 pepr.dev=annotations-work-too`
 */
When(a.ConfigMap)
  .IsCreated()
  .WithName("example-1")
  .Then(request =>
    request
      .SetLabel("pepr", "was-here")
      .SetAnnotation("pepr.dev", "annotations-work-too")
  );

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   CAPABILITY ACTION (CM Example 2)                                *
 * ---------------------------------------------------------------------------------------------------
 *
 * This Capability Action does the exact same changes for example-2, except this time it uses
 * the `.ThenSet()` feature. You can stack multiple `.Then()` calls, but only a single `.ThenSet()`
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
 * ---------------------------------------------------------------------------------------------------
 *                                   CAPABILITY ACTION (CM Example 3)                                *
 * ---------------------------------------------------------------------------------------------------
 *
 * This Capability Action combines different styles. Unlike the previous actions, this one will look
 * for any ConfigMap in the `pepr-demo` namespace that has the label `change=by-label` during either
 * CREATE or UPDATE. Note that all conditions added such as `WithName()`, `WithLabel()`, `InNamespace()`,
 * are ANDs so all conditions must be true for the request to be processed.
 */
When(a.ConfigMap)
  .IsCreatedOrUpdated()
  .WithLabel("change", "by-label")
  .Then(request => {
    // The K8s object e are going to mutate
    const cm = request.Raw;

    // Get the username and uid of the K8s request
    const { username, uid } = request.Request.userInfo;

    // Store some data about the request in the configmap
    cm.data["username"] = username;
    cm.data["uid"] = uid;

    // You can still mix other ways of making changes too
    request.SetAnnotation("pepr.dev", "making-waves");
  });

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   CAPABILITY ACTION (CM Example 4)                                *
 * ---------------------------------------------------------------------------------------------------
 *
 * This Capability Action show how you can use the `Then()` function to make multiple changes to the
 * same object from different functions. This is useful if you want to keep your Capability Actions
 * small and focused on a single task, or if you want to reuse the same function in multiple
 * Capability Actions.
 *
 * Note that the order of the `.Then()` calls matters. The first call will be executed first,
 * then the second, and so on. Also note the functions are not called until the Capability Action
 * is triggered.
 */
When(a.ConfigMap)
  .IsCreated()
  .WithName("example-4")
  .Then(cm => cm.SetLabel("pepr.dev/first", "true"))
  .Then(addSecond)
  .Then(addThird);

/**
 * This function uses the complete type definition, but is not required.
 * @param cm - PeprRequest<a.ConfigMap>
 * @returns void
 */
function addSecond(cm: PeprRequest<a.ConfigMap>): void {
  cm.SetLabel("pepr.dev/second", "true");
}

/**
 * This function has no type definition, so you won't have intellisense in the function body.
 * @param cm
 * @returns void
 */
function addThird(cm): void {
  cm.SetLabel("pepr.dev/third", "true");
}

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   CAPABILITY ACTION (CM Example 5)                                *
 * ---------------------------------------------------------------------------------------------------
 *
 * This Capability Action is a bit more complex. It will look for any ConfigMap in the `pepr-demo`
 * namespace that has the label `chuck-norris` during CREATE. When it finds one, it will fetch a
 * random Chuck Norris joke from the API and add it to the ConfigMap. This is a great example of how
 * you can use Pepr to make changes to your K8s objects based on external data.
 *
 * Note the use of the `async` keyword. This is required for any Capability Action that uses `await` or `fetch()`.
 *
 * Also note we are passing a type to the `fetch()` function. This is optional, but it will help you
 * avoid mistakes when working with the data returned from the API. You can also use the `as` keyword to
 * cast the data returned from the API.
 *
 * These are equivalent:
 *