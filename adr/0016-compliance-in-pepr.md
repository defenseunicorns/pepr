# 14. Compliance in Pepr 

Date: 2025-02-13


## Status

Accepted


## Context

Pepr needs to generate reports for compliance purposes, demonstrating adherence to required security and compliance standards through specific bindings. To achieve this, it’s essential to map compliance controls to Pepr Modules. During our discovery process, we determined that Pepr’s role in compliance should focus on reporting rather than enforcement. This is because compliance controls are already enforced through the bindings themselves, and Pepr’s primary function is to report on the compliance status of resources.

## Decision

After careful consideration, we created an external library, [`compliance-reporter`](https://www.npmjs.com/package/compliance-reporter) that accepts a strongly typed controls, allowing automation of compliance reporting that is consumable by Pepr Modules. This facilitates the generation of compliance reports based on control status. Controls are defined via a `registerControls()` function that takes a `Record<string, Control>` argument. These can be called anywhere and more than once to register all controls. The return value will be used with `mapControl()` to associate a `ControlImplementation` with a `Control`. This is a one-to-one or one-to-many relationship. When multiple ControlImplementations are needed to satisfy a Control, a coverage property can be set to track the estimated percentage of the `Control` that is covered.

## Goals

- Compliance Reporter provides the mechanism to run validation reports.
- The report generation should be either on-demand or on schedule, but first step is to a create `ConfigMap` to be consumed bye other services.
- Ensure compliance reports aggregate all registered controls, even those without implementations.

## Non-Goals

- To create a new way to enforce validation outside of the Pepr Modules.

### Consequences ###

- Introduce `registerControls()` to register compliance controls outside of the bindings.
- Store compliance data in a `ConfigMap` or other Kubernetes resource to be consumed by other services.
- Implement `generateComplianceReport()` to aggregate and related all control data. 
- Provide `findComplianceGaps()` to list all congrols with < 100% coverage.

##### Pros

- Gives Pepr the ability to generate compliance reports based on the status of compliance controls on-demand through another library.
- Straightforward to implement and maintain.
- Should not make a major impact in terms of resource utilization.
- Report generation can be automated.
- Enables type-completions for mapping controls for type visibility.

##### Cons

- Module Authors need to update their modules to install the compliance reporter library.

### Related Repos ###

These repos are related to this ADR in that they house collections of admission policies.

- [Pepr Controls](https://github.com/jeff-mccoy/pepr-controls)
- [Kubernetes Validating Admission Policy Library](https://github.com/vap-library/vap-library)
- [CEL Admission Library](https://github.com/kubescape/cel-admission-library)
