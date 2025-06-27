# 10. Automated Releases

Date: 2024-07-17

## Status

Proposed

## Context

Currently, releasing Pepr is a manual process. This is not ideal because anything done "by hand":

- is subject to the inattentive, accidental nature of humans (everybody has "bad" days),
- requires a _trusted_ human to give effort (if outputs are to be trusted) which is sometimes difficult to arrange in an OSS ecosystem,
- necessitates setting aside training time & attention for new personnel, and
- is really slow -- both to accomplish, and (often) to schedule time for.

In addition, people tend **not** to like repeating mundate tasks over and over (and over, and...) which makes manual releases a prime example of toil.

We want releasing new versions of Pepr to be frictionless -- hands-off, automatic, and safe. As easy as pushing new code.

## Decision

To reduce toil (and all the rest described above) we will fully automate the Pepr release process.

To make interaction with the release automation as simple as possible, we will trigger it automatically at the end of our testing pipelines.  In other words, we want to release after _every_ successful code improvement.


## Consequences

To achieve fully automatic, there are some known roadblocks that that must be cleared.

First, in order for automation to take a given code commit through to release, we will need to introduce a tool that can determine next-appropriate release versions (since we're cutting humans out of the loop!) & incorporate it into our "standard" work processes.

See [11. semantic-release](./0011-semantic-release.md) for more on that.

Second, in order to guarantee the level of feature stability we desire for Pepr, we will need to promote the [Pepr Excellent Examples](https://github.com/defenseunicorns/pepr-excellent-examples) tests from a "run overnight for informational purposes"-status to a "run successfully before every release"-status.

See [12. E2E Testing](./0012-e2e-testing.md) for more on that.

Third, in order to achieve the level of runtime stability we desire for Pepr, we will need to formalize & introduce a new type of testing, one that verifies a candidate Pepr controller's runtime stability & performance over a defined, semi-extended period of time -- a concept we're calling "soak" testing.

See [13. Soak Testing](./0013-soak-testing.md) for more on that.
