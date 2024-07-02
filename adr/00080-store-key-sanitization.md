# 8: Store Key Sanitization

Date: 2024-07-02

## Status

Under Review

## Context

Issues were discovered in a few spots when accepting arbitrary keycloak client ids and setting them into the Store without sanitization. IDs like https://google.com/ failed during `Store.setItem` due to the `/` character and returned 422. 


## Decision

* Base64 encode the key after receiving it from the user and before setting it into the Store.
* Update the Store key prefix with v2: `/data/${capabilityName}-v2-${key}`
* Migrate before calling `this.#onReady()` in the `#receive` function of `src/lib/controller/store.ts`, checking if each key that matches the old prefix, if so, migrating to the new prefix with base64 encoding. 
* Add a new pepr command for viewing store items. like `npx pepr view-store`, maybe a `kubectl` plugin or alias too.
* Enhance existing unit testing to cover the new base64 encoding and migration logic. Add a battery of new fuzz and property-based tests.

## Consequences

1. Users cannot easily read the PeprStore CR
2. We need to migrate existing PeprStore CRs so that the `Store.getItem/Store.removeItem` will not fail due to the base64 encoding.
3. Will slightly slow down the store startup since we need to check and possibly migrate store before onReady.
4. We need to build a new pepr command for viewing store items. like `npx pepr view-store`, maybe a `kubectl` plugin or alias too.

