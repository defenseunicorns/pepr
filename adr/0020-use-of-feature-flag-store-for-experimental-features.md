# 20. Use of Feature Flag Store for Experimental Features

Date: 2025-08-11

## Status

Accepted

## Context

Pepr previously managed feature flags through individual environment variables without a standardized approach. This led to several issues:

1. Inconsistent naming conventions for feature flag environment variables
2. No centralized mechanism for validating or tracking active feature flags
3. No type safety for feature flag values (all values were strings)
4. Lack of documentation around available feature flags
5. No limits on the number of active feature flags, potentially leading to excessive branching complexity in code
6. No easy way to debug which feature flags were active

As Pepr matured, the need for a more structured approach to feature flag management became evident, especially as experimental features were being introduced more frequently.

## Decision

We have implemented a centralized Feature Flag Store using the Singleton pattern in `src/lib/features/store.ts` with these key characteristics:

1. A single source of truth for all feature flags via the exported `featureFlagStore` singleton
2. Standardized loading mechanism supporting both environment variables (prefixed with `PEPR_FEATURE_`) and command-line arguments
3. Type conversion for feature values (boolean, number, string)
4. Strict validation enforcing a maximum of 4 active feature flags at any time
5. Clear debugging capabilities via the `debug()` method
6. Type-safe access to feature values via the `get<T>()` method with optional default values

## Consequences

### Benefits:

1. **Reduced Complexity**: The 4-flag limit ensures that the codebase doesn't become overly complex with excessive conditional branches.
2. **Improved Type Safety**: Feature flag values are automatically converted to appropriate types (boolean, number, string).
3. **Centralized Management**: All feature flags are managed through a single interface.
4. **Better Visibility**: The `debug()` and `getAll()` methods provide clear visibility into active feature flags.
5. **Simplified Testing**: The `reset()` method facilitates testing with different feature flag configurations.

### Risks and Mitigations:

1. **Limiting Innovation**: The 4-flag limit could potentially restrict experimentation. Mitigation: Regularly review and graduate experimental features to stable status or deprecate unused ones.
2. **Breaking Changes**: Standardizing on this approach may require changes to existing code. Mitigation: Provide a transition period where both approaches are supported.
3. **Increased Awareness Required**: Developers must be aware of the feature flag store and its usage patterns. Mitigation: Add clear documentation and examples in the codebase.

The 4-flag limit is a deliberate design choice to manage complexity. Each conditional branch introduced by a feature flag doubles the number of potential code paths, leading to exponential growth in complexity. With 4 flags, there are potentially 2⁴ (16) different code paths, which is considered the maximum reasonable complexity threshold for maintaining code quality and testability within Pepr.
