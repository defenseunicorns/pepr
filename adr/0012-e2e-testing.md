# 13. End-to-end (E2E) Testing

Date: 2024-07-17

## Status

Accepted

Supercedes [9. End-to-end (E2E) Testing](./0009-e2e-testing.md)

## Context

Needs & reasoning from superceded version still stands. The purpose of this update is simply to cover how we expect to use Pepr's E2E tests in light of [10. Automated Releases](./0010-automated-releases.md).

We have long completed initial implementation of the [Pepr Excellent Examples](https://github.com/defenseunicorns/pepr-excellent-examples) E2E test suite and have run nightly executions over a period of 6+ months -- average completion time being sub-10 minutes (huzza parallelization!) -- thus proving their speediness / efficacy.

We now have enough confidence in the E2E's make them an integral part of our pre-release testing process.


## Decision

We will stop executing the E2E test suite once, nightly.

We will start executing the E2E test suite as part of our Pepr testing pipeline.


## Consequences

There will be likely be a moderate increase in Pepr's post-commit/merge test execution runtime (accompanied by a proportional increase in surety, of course).
