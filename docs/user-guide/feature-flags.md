# Feature Flags

Feature flags allow you to enable, disable, or configure features in Pepr.
They provide a way to manage feature rollouts, toggle experimental features, and maintain configuration across different environments.
Feature flags work across both CLI and in-cluster environments, using the same underlying implementation.

Pepr's feature flag system supports:

- Boolean flags
- String values
- Numeric values
- Default values for flags
- Type safety through TypeScript
- Configuration via environment variables
- Configuration via initialization strings
- Consistent behavior in both CLI and in-cluster environments

## Best Practices

1. **Temporary Usage**: Use feature flags for temporary changes, gradual rollouts, or experimental features. Do NOT use feature flags for permanent configuration.
1. **Descriptive Names**: Choose descriptive flag names and provide detailed descriptions in the metadata.
1. **Default Values**: Always provide sensible default values for feature flags.
1. **Type Safety**: Leverage TypeScript's type system when accessing feature flags.
1. **Cleanup**: Remove feature flags that are no longer needed to maintain a clean codebase and stay within the feature flag limit.

## Getting Started

### Using Feature Flags

1. **Enable a CLI feature flag via environment variable:**

   ```bash
   PEPR_FEATURE_REFERENCE_FLAG=true npx pepr@latest
   ```

2. **Enable a CLI feature flag via argument:**

   ```bash
   npx pepr@latest --features="reference_flag=true"
   ```

3. **Configure feature flags for a Pepr module:**
   Add to your `package.json`:

   ```json
   "pepr": {
     "env": {
       "PEPR_FEATURE_REFERENCE_FLAG": true
     }
   }
   ```

## Defining Feature Flags

Feature flags in Pepr are defined in the `FeatureFlags` object.
The `FeatureFlags` object is the source of truth for all available feature flags.

:::caution
To reduce complexity, Pepr enforces a limit of 4 active feature flags.
Exceeding this limit results in an error (e.g., `Error: Too many feature
flags active: 5 (maximum: 4).`)
:::

Feature Flags have:

- A unique key used for programmatic access
- Metadata containing name, description, and default value

Feature flag values are converted to appropriate types:

- `"true"` and `"false"` strings are converted to boolean values
- Numeric strings are converted to numbers
- All other values remain as strings

Example definition:

```typescript
export const FeatureFlags: Record<string, FeatureInfo> = {
  REFERENCE_FLAG: {
    key: "reference_flag",
    metadata: {
      name: "Reference Flag",
      description: "A feature flag to show intended usage.",
      defaultValue: false,
    },
  },
};
```

## Configuration and Workflows

Feature flags are configured in two ways for either CLI or Module use.
Only feature flags defined in the `FeatureFlags` object can be configured.
Attempting to use an undefined flag will result in an error.

### Pepr CLI Workflow

1. **Using environment variables** with the format `PEPR_FEATURE_<FLAG_NAME>`:

   ```bash
   # Run Pepr with debug logging to verify feature flags
   PEPR_FEATURE_REFERENCE_FLAG=true LOG_LEVEL=debug npx pepr@latest
   ```

2. **Using the `--features` CLI argument**:

   ```bash
   LOG_LEVEL=debug npx pepr@latest --features="reference_flag=true"
   ```

### Pepr Module Deployment Workflow

For deployed modules, configure feature flags in the module's `package.json`:

```json
  "pepr": {
    "env": {
      "PEPR_FEATURE_REFERENCE_FLAG": true
    }
  },
```

Build and deploy the module once environment variables are set with a known `$APP_NAME`:

```bash
# Edit your package.json to include feature flags
jq '.pepr.env.PEPR_FEATURE_REFERENCE_FLAG = true' package.json

npx pepr@latest build
npx pepr@latest deploy -i pepr:dev

APP_NAME=pepr-module-name
kubectl logs -n pepr-system --selector app=$APP_NAME | grep "Feature flags store initialized"
```

## Troubleshooting

### Feature Flag Not Recognized

If your feature flag isn't recognized:

1. Verify the flag is defined in the `FeatureFlags` object
2. Check the case of the environment variable (`PEPR_FEATURE_REFERENCE_FLAG` vs `pepr_feature_reference_flag`)
3. Ensure correct format for CLI flags (`reference_flag=true` not `REFERENCE_FLAG=true`)

### Too Many Feature Flags

If you receive the error: `Error: Too many feature flags active: 5 (maximum: 4)`

1. Review active feature flags using `featureFlagStore.getAll()`
2. Remove or consolidate unnecessary feature flags
3. Consider if some flags could be regular configuration instead

### Flag Value Incorrect Type

If your feature flag has an unexpected type:

1. Remember that strings `"true"` and `"false"` are automatically converted to booleans
2. Numeric strings are automatically converted to numbers
3. Use explicit type checking in your code: `typeof featureFlagStore.get(...)`

---

## For Maintainers

## Development Guidelines

### Accessing and Implementing Feature Flags

To add a new feature flag, update the `FeatureFlags` object in the source code.
Any feature flag not defined in this object cannot be used in the application.

Access feature flags the same way in both CLI and in-cluster environments using the `featureFlagStore`.

This snippet shows how to execute different code paths based upon a feature flag value.
To execute within the Pepr project, save the snippet to `file.ts` and run `npx tsx file.ts`.

```typescript
import { featureFlagStore } from "./lib/features/store";
import { FeatureFlags } from "./lib/features/FeatureFlags";

// Get a boolean flag
const isReferenceEnabled = featureFlagStore.get(FeatureFlags.REFERENCE_FLAG.key);

const allFlags = featureFlagStore.getAll();

// Use feature flags for conditional logic
if (featureFlagStore.get(FeatureFlags.REFERENCE_FLAG.key)) {
  Log.info(`Flag value: ${isReferenceEnabled} of type ${typeof featureFlagStore.get(FeatureFlags.REFERENCE_FLAG.key)}`)
} else {
  Log.info(`All flags: ${JSON.stringify(allFlags)}`)
}
```
