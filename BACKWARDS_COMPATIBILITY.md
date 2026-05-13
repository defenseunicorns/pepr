# Backward Compatibility in Pepr

Pepr is committed to providing a stable and reliable experience for developers while allowing room for innovation and improvement. This document outlines Pepr's backward compatibility policies, including guidelines, guarantees, and examples of how we handle breaking changes.

---

## Scope of Backward Compatibility

Backward compatibility in Pepr applies to the following components:

1. **Public API**:
   - Publicly exposed APIs, including function signatures, parameters, and return types. The API includes:
     - [Actions](https://docs.pepr.dev/main/user-guide/actions/)
     - [Capabilities](https://docs.pepr.dev/main/user-guide/capabilities/)
     - [Store](https://docs.pepr.dev/main/user-guide/store/)
     - [OnSchedule](https://docs.pepr.dev/main/user-guide/onschedule/)
2. **Configuration**:
   - YAML or JSON configuration structures for [Pepr Modules](https://docs.pepr.dev/main/user-guide/pepr-modules/). Configuration includes:
     - Environment Variables
       - [Redact Store Values from Logs](https://docs.pepr.dev/main/user-guide/customization/#redact-store-values-from-logs)
       - [Display Node Warnings](https://docs.pepr.dev/main/user-guide/customization/#display-node-warnings)
       - [Customizing Log Format](https://docs.pepr.dev/main/user-guide/customization/#customizing-log-format)
       - [Customizing Watch Configuration](https://docs.pepr.dev/main/user-guide/customization/#customizing-watch-configuration)
       - [Configuring Reconcile](https://docs.pepr.dev/main/user-guide/customization/#configuring-reconcile)
       - [Customizing with Helm](https://docs.pepr.dev/main/user-guide/customization/#customizing-with-helm)
       - [Customizing with package.json](https://docs.pepr.dev/main/user-guide/customization/#customizing-with-packagejson)
3. **Pepr SDK**:
   - Helper functions to frequently used tasks defined in [SDK](https://docs.pepr.dev/main/user-guide/sdk/).
4. **CLI Commands**:
   - Commands, flags, and outputs provided by the [Pepr CLI](https://docs.pepr.dev/main/user-guide/pepr-cli/).

---

## Backward Compatibility Guarantees

Pepr adheres to the following guarantees to ensure a seamless user experience:

### 1. Pepr Versioning

- **Major Versions (X.0.0)**:
  - Introduce breaking changes after a deprecation grace period.
  - Include migration paths and detailed upgrade guides.
- **Minor Versions (X.Y.0)**:
  - Add new features in a backward-compatible manner.
  - Introduce deprecations with announcements and migration paths.
- **Patch Versions (X.Y.Z)**:
  - Include bug fixes, security updates, and performance improvements without changing functionality or APIs.

### 2. Deprecation Policy

- **Deprecation Announcement**:
  - Any feature slated for removal will be marked as deprecated and announced in release notes.
  - Deprecated features will include clear warnings in logs and CLI outputs.
  - Deprecation notices will be included in [Pepr Slack](https://kubernetes.slack.com/archives/c06dgh40ucb).
- **Grace Period**:
  - Deprecated features will remain functional for at least **one release** before removal.

### 3. Test Coverage

- Maintain backward compatibility by validating changes against existing test suites for previously supported versions.
- Include regression tests to ensure deprecated features continue to function as expected until their removal.

---

## Handling Breaking Changes

### 1. Communication

- Breaking changes will only be introduced in major releases.
- Users will be notified via:
  - **Release Notes**: Detailed explanation of changes, migration paths, and alternative solutions.
  - **Documentation Updates**: Guides and examples to help users adapt to the changes.
  - **Pepr Slack**: Announcements will be left in the [Pepr Slack](https://kubernetes.slack.com/archives/c06dgh40ucb) channel with a link to the release notes.

### 2. Migration Paths

- Pepr will provide logic to automatically migrate configurations and data to the new format where possible.

### 3. Feature Flags

- When possible, introduce breaking changes behind feature flags to allow users to opt-in before full adoption.

---

## Examples of Backward Compatibility Practices

### 1. API Changes

- **Scenario**: Adding a new optional parameter to a public API.
  - **Action**: Ensure the default behavior remains unchanged if the parameter is not provided.

### 2. CLI Enhancements

- **Scenario**: Renaming a CLI flag.
  - **Action**: Keep the old flag functional while logging a deprecation warning.

### 3. Configuration Updates

- **Scenario**: Changing a configuration schema.
  - **Action**: Provide an automatic migration tool or fallback to interpret the old schema.

---

## Monitoring and Feedback

### 1. Issue Tracking

- Monitor GitHub Issues and Discussions for reports of backward compatibility [issues](https://github.com/defenseunicorns/pepr/issues).

### 2. Community Involvement

- Solicit feedback from the community on proposed breaking changes before implementation.

---

## Commitment to Stability

Pepr's backward compatibility strategy ensures developers can rely on consistent behavior while adapting to new features and improvements. By clearly communicating changes and providing robust migration tools, we aim to minimize disruptions and foster trust within our user community.

---

### Contact and Support

For questions, concerns, or suggestions regarding backward compatibility, please reach out via:

- [GitHub Issues](https://github.com/defenseunicorns/pepr/issues)
- [Community Discussions](https://github.com/defenseunicorns/pepr/discussions)
