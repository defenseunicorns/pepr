# 16: Store Key Sanitization

Date: 2024-07-02

## Status

Accepted

## Context

Issues were discovered when accepting arbitrary Keycloak client IDs as Store keys without sanitization. For instance, IDs like `https://google.com/` failed during `Store.setItem` due to the `/` character being interpreted as a path separator, resulting in a `422` error.

## Decision

Sanitize the keys by replacing `/` with [one or more characters](https://datatracker.ietf.org/doc/html/rfc6901#section-3) that do not break the [`patch` operation](https://datatracker.ietf.org/doc/html/rfc6902/#section-4) before setting, getting, or deleting a key in/from the store. We will also increase the tests to find other edge cases before releasing the change and deciding upon the exact character or pattern. We are prioritizing the cluster operator persona in this case who wants to quickly check all keys and values in the store by looking at the PeprStore CR.

We migrate the keys in in the CR after the GET operation on the `PeprStore`.

#### Sanitize using String Replacement

* Sanitize the key by replacing `/` with a character that does not break the `patch` operation before getting, setting, or deleting a key.
* Increasing the tests to find other edge cases before releasing the change.

#### Why not use string replacement?

* There is a small risk of that there will be some edge case that we have not discovered yet of a key that cannot be placed in the store

## Alternatives

#### Sanitize using Base64 Encoding

* Base64 encode the key after receiving it from the user and before setting it into the Store.
* Update the Store key prefix with v2: `/data/${capabilityName}-v2-${key}`
* Migrate before calling `this.#onReady()` in the `#receive` function of `src/lib/controller/store.ts`, checking if each key that matches the old prefix, if so, migrating to the new prefix with base64 encoding.
* Add a new pepr command for viewing store items. like `npx pepr view-store`, maybe a `kubectl` plugin or alias too.
* Enhance existing unit testing to cover the new base64 encoding and migration logic. Add a battery of new fuzz and property-based tests.

Example of the Store Resource before and after migration:

Before:

```yaml
apiVersion: pepr.dev/v1
data:
  __pepr_do_not_delete__: k-thx-bye
  hello-pepr-watch-data: This data was stored by a Watch Action.
kind: PeprStore
metadata:
  name: pepr-static-test-store
  namespace: pepr-system
```

After:

```yaml
apiVersion: pepr.dev/v1
data:
  __pepr_do_not_delete__: k-thx-bye
  hello-pepr-v2-watch-data: This data was stored by a Watch Action.
kind: PeprStore
metadata:
  name: pepr-static-test-store
  namespace: pepr-system
```

#### Why not use base64 encoding?

* Although base64 encoding gaurantees that the key will be unique and not contain any special characters, it will introduce a lot of overhead:
* * Harder for users to read PeprStore CR because key names will be encoded
* * Require a npx pepr command for viewing all store items at once?
* * Require a new store path prefix.
* * Potentially would want a k9s command for cluster users to be able to view PeprStore CR
* * A lot must be done for a relatively simple problem that is based on the issue and much is lost in terms of interacting with the PeprStore CR.

## Pros and Cons of the Decision

### Pros

* No migration path required because keys that cannot get placed in the store are not in the store
* No overhead of base64 encoding/decoding
* No new store path prefix
* No new pepr command for viewing store items because users can see the PeprStore CR as always
* Add more unit and e2e tests around the store
* No need for a k9s command for k9s users to be able to view PeprStore CR

### Cons

* Could be edge cases that we have not discovered yet of a key that you cannot place in the store

## Consequences

1. Implement the sanitization feature so that the store can accept arbitrary keycloak client ids
2. Add fuzz and property-based tests to find edge cases
3. Add more e2e tests around the store
