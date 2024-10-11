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


### Pepr's Homework

- Add a new image verification helper + image verification libraries to the Pepr Controller.

- Expose new functionality as (something like): 
  ```
  (registry-ref, public-key-defs) =>  { return bool-if-the-image-sig-is-valid }
  ```

- New functionality must be able to validate `cosign` image signatures.


### Implementation Options

Cosign is a signing & signature verification tool, written and distributed as a Go library and/or standalone binary.

To make it accessible to the Pepr controller one of the following will have to happen:

#### Install CLI

The CLI binary could be shipped along with the Pepr controller & Pepr could just shell out to it.

##### Pros

- Requires minimal new Pepr-custom code

- Easy to install / update

- Simple, well-documented surface area / API

- CLI code from repo under the sigstore umbrella

##### Cons

- All-or-nothing &mdash; can't "shake" out / sub-select unused functionality
- Deployment size increase - shipping [cosign v2.4.1](https://github.com/sigstore/cosign/releases/download/v2.4.1/cosign-linux-amd64) would add another 105MB to a ~150MB controller image size (nearly 2x).


#### Pull-in the Go lib

The Go library could be shipped along with the Pepr controller & Pepr could access it through using a cross-language access technology (i.e. WebAssembly).

##### Pros

- Requires minimal new Pepr-custom code

- Lib code from repo under the sigstore umbrella

- WebAssembly is neat!

##### Cons

- Requires inclusion of a Go lang toolchain f/ development

- Requires install / use an inter-language translation layer (i.e. WebAssembly)

- (Likely) makes runtime debugging more difficult (because .wasm is a binary format )


#### Add Go-native Sidecar

The Go library could be shipped as part of a "Go-based microservice" and deployed as a sidecar to the Pepr controller.  Pepr could access it through some form of IPC.

##### Pros

- Makes use of Go-based libraries simple

- As much of the "cloud native" space is built on Go, better positions Pepr for inclusion of other domain-adjacent libs

- Lib code from repo under the sigstore umbrella


##### Cons

- Requires inclusion of a Go lang toolchain f/ development

- Requires orchestration between independent processes (i.e. node proc & go proc)

- Requires IPC between independent processes (i.e. node proc & go proc), possibly over a network (i.e. gRPC)


#### Install JS-native lib

A JS-native binding / rewrite / wrapper for cosign functionality could be pulled in (i.e. [sigstore-js](https://github.com/sigstore/sigstore-js/tree/main/packages/cli)).

##### Pros

- Written in Pepr-native language (JavaScript) so fits into existing toolset

- Lib code from repo under the sigstore umbrella

##### Cons

- n/a

### Chosen Implementation Option

Install JS-native lib &mdash; [sigstore-js](https://github.com/sigstore/sigstore-js).

Despite the other options having more appeal in terms of technical interest (WebAssembly is _neat_!) and/or offering to take Pepr a step twoard other "cloud native" tools (i.e. largely available as Go libs), this option is:

- the simplest to implement _by far_, and

- has the least impact on the controller architecture & dev toolchain.

Hence, the Pepr team will approach implementing this new functionality base on the JS-native `sigstore-js` lib.


## Decision

Pepr will add a new image verification helper & image verification libraries to the Pepr Controller &mdash; something approximating the form: `(registry-ref, public-key-defs) =>  { return bool-if-the-image-sig-is-valid }` &mdash; which should be able to validate `cosign` image signatures (by way of the [sigstore-js](https://github.com/sigstore/sigstore-js) lib).

UDS Operator will take advantage of the new verification helper to validate admission of Pods into the UDS cluster.


## Consequences

UDS Operator team will be able to use the new helper in during admission-time checking within the UDS Operator.

Pepr Controller will grow in size through inclusion of a new image validation library; degree of growth is expected to be minimal (10s of kB)

Pepr SDK / "helpers" library will expand through inclusion of new helper method.
