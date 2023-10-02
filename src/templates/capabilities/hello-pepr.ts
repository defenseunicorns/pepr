import {
  Capability,
  K8s,
  Log,
  PeprMutateRequest,
  RegisterKind,
  a,
  fetch,
  fetchStatus,
  kind,
} from "pepr";

/**
 *  The HelloPepr Capability is an example capability to demonstrate some general concepts of Pepr.
 *  To test this capability you run `pepr dev`and then run the following command:
 *  `kubectl apply -f capabilities/hello-pepr.samples.yaml`
 */
export const HelloPepr = new Capability({
  name: "hello-pepr",
  description: "A simple example capability to show how things work.",
  namespaces: ["pepr-demo", "pepr-demo-2"],
});

// Use the 'When' function to create a new action, use 'Store' to persist data
const { When, Store } = HelloPepr;

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   Mutate Action (Namespace)                                   *
 * ---------------------------------------------------------------------------------------------------
 *
 * This action removes the label `remove-me` when a Namespace is created.
 * Note we don't need to specify the namespace here, because we've already specified
 * it in the Capability definition above.
 */
When(a.Namespace)
  .IsCreated()
  .Mutate(ns => ns.RemoveLabel("remove-me"));

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   Watch Action with K8s SSA (Namespace)                           *
 * ---------------------------------------------------------------------------------------------------
 *
 * This action watches for the `pepr-demo-2` namespace to be created, then creates a ConfigMap with
 * the name `pepr-ssa-demo` and adds the namespace UID to the ConfigMap data. Because Pepr uses
 * server-side apply for this operation, the ConfigMap will be created or updated if it already exists.
 */
When(a.Namespace)
  .IsCreated()
  .WithName("pepr-demo-2")
  .Watch(async ns => {
    Log.info("Namespace pepr-demo-2 was created.");

    // You can share data between actions using the Store, including between different types of actions
    Store.setItem("watch-data", "This data was stored by a Watch Action.");

    // Apply the ConfigMap using K8s server-side apply
    await K8s(kind.ConfigMap).Apply({
      metadata: {
        name: "pepr-ssa-demo",
        namespace: "pepr-demo-2",
      },
      data: {
        "ns-uid": ns.metadata.uid,
      },
    });
  });

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   Mutate Action (CM Example 1)                                *
 * ---------------------------------------------------------------------------------------------------
 *
 * This is a single action. They can be in the same file or put imported from other files.
 * In this example, when a ConfigMap is created with the name `example-1`, then add a label and annotation.
 *
 * Equivalent to manually running:
 * `kubectl label configmap example-1 pepr=was-here`
 * `kubectl annotate configmap example-1 pepr.dev=annotations-work-too`
 */
When(a.ConfigMap)
  .IsCreated()
  .WithName("example-1")
  .Mutate(request => {
    request
      .SetLabel("pepr", "was-here")
      .SetAnnotation("pepr.dev", "annotations-work-too");

    // Use the Store to persist data between requests and Pepr controller pods
    Store.setItem("example-1", "was-here");

    // This data is written asynchronously and can be read back via `Store.getItem()` or `Store.subscribe()`
    Store.setItem("example-1-data", JSON.stringify(request.Raw.data));
  });

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   Mutate & Validate Actions (CM Example 2)                                *
 * ---------------------------------------------------------------------------------------------------
 *
 * This combines 3 different types of actions: 'Mutate', 'Validate', and 'Watch'. The order
 * of the actions is required, but each action is optional. In this example, when a ConfigMap is created
 * with the name `example-2`, then add a label and annotation, validate that the ConfigMap has the label
 * `pepr`, and log the request.
 */
When(a.ConfigMap)
  .IsCreated()
  .WithName("example-2")
  .Mutate(request => {
    // This Mutate Action will mutate the request before it is persisted to the cluster

    // Use `request.Merge()` to merge the new data with the existing data
    request.Merge({
      metadata: {
        labels: {
          pepr: "was-here",
        },
        annotations: {
          "pepr.dev": "annotations-work-too",
        },
      },
    });
  })
  .Validate(request => {
    // This Validate Action will validate the request before it is persisted to the cluster

    // Approve the request if the ConfigMap has the label 'pepr'
    if (request.HasLabel("pepr")) {
      return request.Approve();
    }

    // Otherwise, deny the request with an error message (optional)
    return request.Deny("ConfigMap must have label 'pepr'");
  })
  .Watch((cm, phase) => {
    // This Watch Action will watch the ConfigMap after it has been persisted to the cluster
    Log.info(cm, `ConfigMap was ${phase} with the name example-2`);
  });

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   Mutate Action (CM Example 2a)                               *
 * ---------------------------------------------------------------------------------------------------
 *
 * This action shows a simple validation that will deny any ConfigMap that has the
 * annotation `evil`. Note that the `Deny()` function takes an optional second parameter that is a
 * user-defined status code to return.
 */
When(a.ConfigMap)
  .IsCreated()
  .Validate(request => {
    if (request.HasAnnotation("evil")) {
      return request.Deny("No evil CM annotations allowed.", 400);
    }

    return request.Approve();
  });

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   Mutate Action (CM Example 3)                                *
 * ---------------------------------------------------------------------------------------------------
 *
 * This action combines different styles. Unlike the previous actions, this one will look
 * for any ConfigMap in the `pepr-demo` namespace that has the label `change=by-label` during either
 * CREATE or UPDATE. Note that all conditions added such as `WithName()`, `WithLabel()`, `InNamespace()`,
 * are ANDs so all conditions must be true for the request to be processed.
 */
When(a.ConfigMap)
  .IsCreatedOrUpdated()
  .WithLabel("change", "by-label")
  .Mutate(request => {
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

// This action validates the label `change=by-label` is deleted
When(a.ConfigMap)
  .IsDeleted()
  .WithLabel("change", "by-label")
  .Validate(request => {
    // Log and then always approve the request
    Log.info("CM with label 'change=by-label' was deleted.");
    return request.Approve();
  });

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   Mutate Action (CM Example 4)                                *
 * ---------------------------------------------------------------------------------------------------
 *
 * This action show how you can use the `Mutate()` function without an inline function.
 * This is useful if you want to keep your actions small and focused on a single task,
 * or if you want to reuse the same function in multiple actions.
 */
When(a.ConfigMap).IsCreated().WithName("example-4").Mutate(example4Cb);

// This function uses the complete type definition, but is not required.
function example4Cb(cm: PeprMutateRequest<a.ConfigMap>) {
  cm.SetLabel("pepr.dev/first", "true");
  cm.SetLabel("pepr.dev/second", "true");
  cm.SetLabel("pepr.dev/third", "true");
}

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   Mutate Action (CM Example 4a)                                *
 * ---------------------------------------------------------------------------------------------------
 *
 * This is the same as Example 4, except this only operates on a CM in the `pepr-demo-2` namespace.
 * Note because the Capability defines namespaces, the namespace specified here must be one of those.
 * Alternatively, you can remove the namespace from the Capability definition and specify it here.
 */
When(a.ConfigMap)
  .IsCreated()
  .InNamespace("pepr-demo-2")
  .WithName("example-4a")
  .Mutate(example4Cb);

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   Mutate Action (CM Example 5)                                *
 * ---------------------------------------------------------------------------------------------------
 *
 * This action is a bit more complex. It will look for any ConfigMap in the `pepr-demo`
 * namespace that has the label `chuck-norris` during CREATE. When it finds one, it will fetch a
 * random Chuck Norris joke from the API and add it to the ConfigMap. This is a great example of how
 * you can use Pepr to make changes to your K8s objects based on external data.
 *
 * Note the use of the `async` keyword. This is required for any action that uses `await` or `fetch()`.
 *
 * Also note we are passing a type to the `fetch()` function. This is optional, but it will help you
 * avoid mistakes when working with the data returned from the API. You can also use the `as` keyword to
 * cast the data returned from the API.
 *
 * These are equivalent:
 * ```ts
 * const joke = await fetch<TheChuckNorrisJoke>("https://api.chucknorris.io/jokes/random?category=dev");
 * const joke = await fetch("https://api.chucknorris.io/jokes/random?category=dev") as TheChuckNorrisJoke;
 * ```
 *
 * Alternatively, you can drop the type completely:
 *
 * ```ts
 * fetch("https://api.chucknorris.io/jokes/random?category=dev")
 * ```
 */
interface TheChuckNorrisJoke {
  icon_url: string;
  id: string;
  url: string;
  value: string;
}

When(a.ConfigMap)
  .IsCreated()
  .WithLabel("chuck-norris")
  .Mutate(async change => {
    // Try/catch is not needed as a response object will always be returned
    const response = await fetch<TheChuckNorrisJoke>(
      "https://api.chucknorris.io/jokes/random?category=dev",
    );

    // Instead, check the `response.ok` field
    if (response.ok) {
      // Add the Chuck Norris joke to the configmap
      change.Raw.data["chuck-says"] = response.data.value;
      return;
    }

    // You can also assert on different HTTP response codes
    if (response.status === fetchStatus.NOT_FOUND) {
      // Do something else
      return;
    }
  });

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   Mutate Action (Secret Base64 Handling)                      *
 * ---------------------------------------------------------------------------------------------------
 *
 * The K8s JS client provides incomplete support for base64 encoding/decoding handling for secrets,
 * unlike the GO client. To make this less painful, Pepr automatically handles base64 encoding/decoding
 * secret data before and after the action is executed.
 */
When(a.Secret)
  .IsCreated()
  .WithName("secret-1")
  .Mutate(request => {
    const secret = request.Raw;

    // This will be encoded at the end of all processing back to base64: "Y2hhbmdlLXdpdGhvdXQtZW5jb2Rpbmc="
    secret.data.magic = "change-without-encoding";

    // You can modify the data directly, and it will be encoded at the end of all processing
    secret.data.example += " - modified by Pepr";
  });

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   Mutate Action (Untyped Custom Resource)                     *
 * ---------------------------------------------------------------------------------------------------
 *
 * Out of the box, Pepr supports all the standard Kubernetes objects. However, you can also create
 * your own types. This is useful if you are working with an Operator that creates custom resources.
 * There are two ways to do this, the first is to use the `When()` function with a `GenericKind`,
 * the second is to create a new class that extends `GenericKind` and use the `RegisterKind()` function.
 *
 * This example shows how to use the `When()` function with a `GenericKind`. Note that you
 * must specify the `group`, `version`, and `kind` of the object (if applicable). This is how Pepr knows
 * if the action should be triggered or not. Since we are using a `GenericKind`,
 * Pepr will not be able to provide any intellisense for the object, so you will need to refer to the
 * Kubernetes API documentation for the object you are working with.
 *
 * You will need to wait for the CRD in `hello-pepr.samples.yaml` to be created, then you can apply
 *
 * ```yaml
 * apiVersion: pepr.dev/v1
 * kind: Unicorn
 * metadata:
 *   name: example-1
 *   namespace: pepr-demo
 * spec:
 *   message: replace-me
 *   counter: 0
 * ```
 */
When(a.GenericKind, {
  group: "pepr.dev",
  version: "v1",
  kind: "Unicorn",
})
  .IsCreated()
  .WithName("example-1")
  .Mutate(request => {
    request.Merge({
      spec: {
        message: "Hello Pepr without type data!",
        counter: Math.random(),
      },
    });
  });

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   Mutate Action (Typed Custom Resource)                       *
 * ---------------------------------------------------------------------------------------------------
 *
 * This example shows how to use the `RegisterKind()` function to create a new type. This is useful
 * if you are working with an Operator that creates custom resources and you want to have intellisense
 * for the object. Note that you must specify the `group`, `version`, and `kind` of the object (if applicable)
 * as this is how Pepr knows if the action should be triggered or not.
 *
 * Once you register a new Kind with Pepr, you can use the `When()` function with the new Kind. Ideally,
 * you should register custom Kinds at the top of your Capability file or Pepr Module so they are available
 * to all actions, but we are putting it here for demonstration purposes.
 *
 * You will need to wait for the CRD in `hello-pepr.samples.yaml` to be created, then you can apply
 *
 * ```yaml
 * apiVersion: pepr.dev/v1
 * kind: Unicorn
 * metadata:
 *   name: example-2
 *   namespace: pepr-demo
 * spec:
 *   message: replace-me
 *   counter: 0
 * ```*
 */
class UnicornKind extends a.GenericKind {
  spec: {
    /**
     * JSDoc comments can be added to explain more details about the field.
     *
     * @example
     * ```ts
     * request.Raw.spec.message = "Hello Pepr!";
     * ```
     * */
    message: string;
    counter: number;
  };
}

RegisterKind(UnicornKind, {
  group: "pepr.dev",
  version: "v1",
  kind: "Unicorn",
});

When(UnicornKind)
  .IsCreated()
  .WithName("example-2")
  .Mutate(request => {
    request.Merge({
      spec: {
        message: "Hello Pepr with type data!",
        counter: Math.random(),
      },
    });
  });

/**
 * A callback function that is called once the Pepr Store is fully loaded.
 */
Store.onReady(data => {
  Log.info(data, "Pepr Store Ready");
});
