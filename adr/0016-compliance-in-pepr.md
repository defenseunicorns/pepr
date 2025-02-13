# 14. Compliance in Pepr 

Date: 2025-02-13


## Status

Pending


## Context

Pepr needs to generate reports for compliance purposes, demonstrating adherence to required security and compliance standards through specific bindings. To achieve this, it’s essential to map compliance controls to Pepr’s bindings. During our discovery process, we determined that Pepr’s role in compliance should focus on reporting rather than enforcement. This is because compliance controls are already enforced through the bindings themselves, and Pepr’s primary function is to report on the compliance status of resources.

## Decision

Extend the fluent API with a new keyword function that accepts a strongly typed control, allowing it to be associated with a given binding. This enables users to map compliance controls to Pepr’s bindings, facilitating the generation of compliance reports based on control status.


### Consequences ###

- Extend the Capability class with a new function, such as `CompliesWith()`, that accepts a strongly typed control to associate it with a given binding.
- Store compliance data in `PeprStore` (or introduce a new store for this purpose).
- Prevent deletion of compliance data from PeprStore for audit purposes, unless a new store is used.
- Enhance the Pepr CLI to generate compliance reports based on stored compliance data.

##### Pros

- Gives Pepr the ability to generate compliance reports based on the status of compliance controls on demand.
- Straightforward to implement and maintain.
- Should not make a major impact in terms of resource utilization.

##### Cons

_Questions_
- How do Exemptions work here?
- What does the audit trail look like
- We should probably just use a new store where the Store API is not mapped

### Related Repos ###

These repos are related to this ADR in that they house collections of admission policies.

- [Kubernetes Validating Admission Policy Library](https://github.com/vap-library/vap-library)
- [CEL Admission Library](https://github.com/kubescape/cel-admission-library)
