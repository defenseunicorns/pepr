# Pepr Overview

## What is Pepr?

> **Type safe Kubernetes middleware for humans**

Pepr is on a mission to save Kubernetes from the tyranny of YAML, intimidating glue code, bash scripts, and other makeshift solutions. As a Kubernetes controller, Pepr empowers you to define Kubernetes transformations using TypeScript, without software development expertise thanks to plain-english configurations. Pepr transforms a patchwork of forks, scripts, overlays, and other chaos into a cohesive, well-structured, and maintainable system. With Pepr, you can seamlessly transition IT ops tribal knowledge into code, simplifying documentation, testing, validation, and coordination of changes for a more predictable outcome.

***Note: Pepr is still in active development so breaking changes may occur, but will be documented in release notes.***

## How Pepr Works

## Target Use Cases

## How to Use Pepr

## Why Use Pepr?

## Features

### Out of the Box Features

- Zero-config K8s webhook mutations and validations
- Automatic leader-elected K8s resource watching
- Lightweight async key-value store backed by K8s for stateful operations with the Pepr Store
- Human-readable fluent API for generating Pepr Capabilities
- A fluent API for creating/modifying/watching and server-side applying K8s resources via Kubernetes Fluent Client
- Generate new K8s resources based off of cluster resource changes
- Perform other exec/API calls based off of cluster resources changes or any other arbitrary schedule
- Out of the box airgap support with Zarf
- Entire NPM ecosystem available for advanced operations
- Realtime K8s debugging system for testing/reacting to cluster changes
- Controller network isolation and tamper-resistent module execution
- Least-privilege RBAC generation
- AMD64 and ARM64 support

### Configurable Features
