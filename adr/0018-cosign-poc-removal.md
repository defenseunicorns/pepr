# 18. Removal of Cosign Proof-of-Concept from Project

Date: 2025-03-18

## Status

Accepted

## Context

In Oct 2024 we started prototyping around how we might accomplish validating image signatures against pubkeys derived from the OCI registries that serve them (see [pepr/#1240](https://github.com/defenseunicorns/pepr/issues/1240)).
A proof-of-concept implementation was provided later that month (see [pepr/#1262](https://github.com/defenseunicorns/pepr/pull/1262)).
By the end of the month, we chose to disable testing for the proof-of-concept code due to intermittent CI failures (see [pepr/#1368](https://github.com/defenseunicorns/pepr/pull/1368)).

As of Mar 2025, the cosign implementation is not in use and adds additional dependencies to Pepr. Therefore, we should remove the code and document that the research was done and is available in project history (i.e., this ADR).

### Initial Ask ###

Increase security posture against images coming into cluster to ensure signatures match expected signature

* Read the image from the (internal) image registry
* Read the expected signature (from Zarf)
* Verify that the signature from Zarf matches the signature from the image with the public key

### Evaluation Criteria ###

* Given an image comes in the cluster and there is a signature associated with it
* When pod comes through admission
* Then the image is verified against the signature

### Decision ###

Remove unused code from project.

### Consequences ###

The unused code is unavailable unless a developer digs through project history.
Reference commits [`0971bd3`](https://github.com/defenseunicorns/pepr/commit/0971bd3) and [`e44721a`](https://github.com/defenseunicorns/pepr/commit/e44721a) on `main`.

##### Pros

- Unused code is removed from current versions of Pepr
- Unnecessary dependencies are removed from the project.

##### Cons

- Risk of losing organizational knowledge if cosign validation is required, hence this ADR.
