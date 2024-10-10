# 14. Admission-time verification of image signatures

Date: 2024-10-10


## Status

Proposed


## Context

### Initial Ask ###

Initial ask from Delivery Engineer via Slack / [#product-support](https://defense-unicorns.slack.com/archives/C06QJAUHWFN/p1728323485054109):

```
I want to be able to configure a Kubernetes Validating Admission Webhook that blocks the deployment of any container unless it (a) is specified in an allow-list, or (b) is proven to originate from "an approved registry" (e.g. registry1.dso.mil) and has not been changed, by either comparing SHAs or by validating that the container image has been crypto-signed by Iron Bank.

[...]

Or, more generally: "aside from a specific allow-list, all containers deployed to the cluster must come from <OneOrMoreApprovedContainerRegistries>".
```

### Scoping determinations ###

Slack coversation surrounding the above led to the following scoping determinations:

- This is a UDS-desired feature and will, ultimately, be the responsibility of the UDS Team to fully implement &mdash; by way of the UDS Operator.

- The following supplemental teams / tools / circumstances of involvement were also agreed upon:
  - If there is a desire to generate reproducible / auditable evidence that demonstrates adherence to this "proven image" policy, it could / should be carried out in collab with the Lula team.

  - If there is a desire to enforce a policy at runtime &mdash; enforced via the Kubernetes admission control mechanism &mdash; it could / should be carried out in collab with the Pepr team.

- The desired verification mechanism &mdash; to prove that an image originates from an approved registry &mdash; would be to use the `cosign` tool to validate that images being requested have been signed by crypto that originates from approved sources (i.e. image registries).

- There are two major scenarios that should be accounted for:
    1) verifying images that have been burned into a UDS Package and are therefore distributed by the "local Zarf registry", and
    2) verifying images that are being pulled directly from remote sources (e.g. GitLab Runners running user-defined images (which could reasonably be from _anywhere_ network-reachable)).

  The distinction is important because the UDS Operator will (likely) be able to pass remote-registry-derive image refs through to validation code unchaged but will (likely) have to do some some level of URL translation (e.g. 127.0.0.1:31999 --> docker-registry.zarf.svc.cluster.local:5000) on image refs coming from the "local Zarf registry" (given the way Zarf works).

- Since the desire to validate images signatures against registry-published signing keys is sufficently general, the logic & libs necessary to do so should be built right into the Pepr controller (as opposed to being wholely-owned by the UDS Operator team).
  - Is (likely) to be exposed as one-or-more new helpers under the `<pepr>/src/sdk` hierarchy.
  - Is expected to present as a new Module Author-callable function with a signature something like:
    ```
    (registry-ref, public-key-defs) =>  { return bool-if-the-image-sig-is-valid }
    ```

- Since the logic required to pull & package registry signing keys for distribution via Zarf Package is _not_ sufficiently general (from Pepr's PoV), that task will we left with the UDS Operator team.
  - ...with the expectation that they'll do the work necessary to acquire, package, deploy, and expose _all_ of the public registry derived crypto (signing keys) necessary for the new Pepr-native functionality to validate images served from the "local Zarf registry". 



## Decision

TBD

Working through options in design doc &mdash;
[1. Admission-time verification of image signatures](./0001-admission-verify-img-sigs.md).


## Consequences

TBD