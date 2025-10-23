# 11. semantic-release

Date: 2024-07-17

## Status

Accepted

## Context

As described in [10. Automated Releases](./0010-automated-releases.md), Pepr is in need of a tool to help with automatic versioning of project releases. Specifically, one that can:

- understand [Semantic Versioning](https://semver.org/) -- the versioning standard Pepr follows (though, currently a manual process),

- examine project commits to determine the next, logical version number for a given release, and

- be cleanly integrated into the development workflow (without introducing additional developer toil).

A brief look into [13. Soak Testing](./0013-soak-testing.md) also suggests that this new tool should facilitate (or, at least not disrupt) the identification, promotion, and publishing of properly versioned, to-be-tested, intermediate releases (i.e. "release candidates") as well.

An investigation into the [semantic-release project](https://github.com/semantic-release/semantic-release) shows that it almost perfectly meets (or exceeds) the above conditions.

Pros:
- It povides the needed functionality (and more) -- e.g. pre-established patterns for [performing "pre-releases"](https://semantic-release.gitbook.io/semantic-release/recipes/release-workflow/pre-releases)  (think: release candidates),
- runs in the same ecosystem as Pepr (Node.js) -- meaning no new developer tool sets to learn / support, 
- is an open source project -- meaning source is available for investigation and update,
- is widely used & well-supported -- with over 1500 commits / 200 contributors / 400 releases on GitHub and a million weekly downloads from NPM (at time of writing) there is very little worry about longevity.

Cons:
- It takes a [firm](https://github.com/semantic-release/semantic-release/issues/1507) [stance](https://semantic-release.gitbook.io/semantic-release/support/faq#can-i-set-the-initial-release-version-of-my-package-to-0.0.1) on _not supporting_ "version zero" (v0.0.1) -style workflows and suggests that projects start at v1.0.0 instead. We get around this by delegating the actual release to SLSA 3 workflow.

The balance of Pros, the Con-that-isn't-much-of-a-con, and fact that Pepr's sister project, the [Kubernetes Fluent Client (a.k.a. "the KFC")](https://github.com/defenseunicorns/kubernetes-fluent-client), is already using the semantic-release tool makes pulling it into Pepr an easy choice.


## Decision

We will pull the semantic-release library into the Pepr project and use it as a core part of our development versioning & package release automation.


## Consequences

Due to the desire to maintain SLSA 3 compliance within Pepr, the actual publishing of releases (i.e. pushing to NPM) will still occur within the SLSA 3 workflow defined in [10. Automated Releases](./0010-automated-releases.md). However, semantic-release will be used to determine the next version number, generate release notes, and create git tags for each release.
