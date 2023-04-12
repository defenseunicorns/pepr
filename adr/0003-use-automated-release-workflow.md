# 3. Use automated release workflow

Date: YYYY-MM-DD

## Status

Accepted

## Context

Currently, our project relies on manual versioning and release management. This manual process increases the likelihood of human error, creates extra work, and does not align well with the Continuous Delivery principles we want to follow.

We need a solution that automates versioning and release management, making it easier to maintain a consistent, predictable release process while adhering to CD principles.

## Decision

We have decided to adopt [semantic-release](https://github.com/semantic-release/semantic-release) for automated versioning and release management. Semantic-release automates the following tasks:

- Determine the next version number based on commit messages (using [Conventional Commits](https://www.conventionalcommits.org/))
- Generate release notes and update the CHANGELOG
- Publish the new version to npm
- Create a GitHub release with the generated release notes

This solution will enable us to:

- Streamline our release process
- Reduce human error in versioning and releasing
- Enforce a consistent commit message format
- Automatically generate release notes and update the CHANGELOG
- Follow Continuous Delivery principles by keeping the main branch always releasable

## Consequences

- Team members will need to familiarize themselves with semantic-release and the Conventional Commits specification.
- We will need to ensure that the project is configured correctly for semantic-release, including any required tokens for publishing to npm and creating GitHub releases.
- We will need to update our existing development workflow to include PR-based development and squash-merge PRs to ensure that semantic-release works correctly.
- Since semantic-release relies on commit messages, we
