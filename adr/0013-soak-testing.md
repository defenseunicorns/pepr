# 12. Soak Testing

Date: 2024-07-17

## Status

Accepted

## Context

As introduced in [10. Automated Releases](./0010-automated-releases.md), various types of validation have to be performed before a new Pepr release can be cut with confidence -- this ADR covers a new long(-ish) running type we're calling "soak testing" which aims to verify a candidate controller's runtime performance & stability _over time_.

The "soak" in soak testing comes from the idea that we can surface a whole class of problems -- those that only occur once Pepr has been running for an extended period -- by "soaking" a Pepr module inside an active Kubernetes cluster (think: soaking a tea bag in a teapot to bring out its flavor). The Pepr team discovered some time ago that dependencies don't always [work as described / expected](https://github.com/kubernetes-client/javascript/issues/596) and that even simple symptom reproductions can take [quite a while](https://github.com/defenseunicorns/pepr/issues/745) to surface issues, so validations of this type are helpful.

With [11. semantic-release](./0011-semantic-release.md)'s support for creating [pre-releases](https://semantic-release.gitbook.io/semantic-release/recipes/release-workflow/pre-releases), we can trivially produce versioned, not-for-public-consumption artifacts (i.e. "release candidates") that'll allow soaking Pepr as a regular part of our test & release pipelines.

By arranging our soak testing stack to validate clearly versioned, pre-release artifacts -- distributed over the same channels as a "normal" production releases (i.e. [npmjs.com](https://www.npmjs.com/package/pepr)) -- we gain the additional benefit of having well-defined Pepr "release candidates" available for external parties to excercise / provide feedback on too (which is a big benefit for a project that sits at the bottom of a complex tech-stack like [UDS](https://github.com/defenseunicorns/uds-core)).

_Currently_, soak testing in Pepr consists of a set manual activities -- instructions + copy & paste-able scripts -- stored in [Pepr Excellent Examples / hello-pepr-soak](https://github.com/defenseunicorns/pepr-excellent-examples/tree/main/hello-pepr-soak). But, as with most things done manually, they are somewhat developer-specific & easy to flub / forget; they are also not currently run in CI.  Not ideal.


## Decision

We will implement a new type of testing into Pepr's processes for CI / release: soak testing. We will invoke the soak test suite via pipeline, automatically: after a successful E2E run, before cutting a new production release.

The soak tests will run on independently versioned, "release candidates" cut / published via [11. semantic-release](./0011-semantic-release.md).

The soak tests will live in [Pepr Excellent Examples / hello-pepr-soak](https://github.com/defenseunicorns/pepr-excellent-examples/tree/main/hello-pepr-soak).


## Consequences

We have to will convert the body of work held in [Pepr Excellent Examples / hello-pepr-soak](https://github.com/defenseunicorns/pepr-excellent-examples/tree/main/hello-pepr-soak) into something suitable for execution in a pipeline (i.e. _not_ manual instructions).

We will need time to implement the soak test suite once we figure out a how to _fully-automatically_:
- create / cleanup a soak cluster,
- establish initial cluster state,
- validate that "everything still works" after XYZ hours of Pepr execution.
    - &uarr;&uarr; initial thought is to cause a lot of cluster churn & make sure that anything soak-created is also _cleanly_ soak-deleted (a.k.a. "start empty, stop empty") but the efficacy that strat remains to be seen.
