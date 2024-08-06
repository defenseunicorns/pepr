# 9. End-to-end (E2E) Testing

Date: 2023-11-02

## Status

Superceded by [12. E2E Testing](./0012-e2e-testing.md)

## Context

Pepr's feature set has expanded beyond what is easily held in-mind.  

Additionally, its method for (partially) describing supported functionality -- a single, templatized, uber-capability called "hello-pepr" -- is showing its age. Designed primarly as a combined introduction & demonstration tool, hello-pepr has gotten unwieldy from aggregating examples in an ad-hoc manner. This makes it difficult to scan for known-included examples and tricky to know where to place new ones (or how comprehensive to make them).

Pair that with Pepr moving out of proof-of-concept status and it becomes obvious that we need a better way to test the _whole_ of its featureset -- ideally something that is easier to examine, maintain, and parallelize the execution of.


## Decision

We will create a new, standalone repository full of independently executable, example modules -- one for each major feature -- and populate them such that they exercise the full scope of Pepr.

We will ensure that each feature module contains a suite of tests that exercise the feature in full, within an actual Kubernetes cluster (k3d).

We will use these module tests --  which we're calling Pepr's "End-to-end (E2E)" tests -- as a way to continually validate Pepr and avoid functionality regressions.

As these tests are expected to have a non-trivial runtime, we will run what we can of them (expecting that they'll take a while to implement fully) as a nightly job. We will discuss when & how to pull them nearer to CI as they become more complete / we have a better idea of their runtime characteristics.


## Consequences

There will be a new repo to be managed: the [Pepr Excellent Examples](https://github.com/defenseunicorns/pepr-excellent-examples).

There will be a fresh test report available for review, daily.
