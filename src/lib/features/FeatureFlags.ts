import { FeatureInfo } from "./FeatureTypes";

/**
 * All known feature flags with their metadata
 */

export const FeatureFlags: Record<string, FeatureInfo> = {
  DEBUG_MODE: {
    key: "debug_mode",
    metadata: {
      name: "Debug Mode",
      description: "Enables verbose logging and debugging features",

      defaultValue: true,
    },
  },
  EXPERIMENTAL_API: {
    key: "experimental_api",
    metadata: {
      name: "Experimental API",
      description: "Enables experimental APIs that may change",

      defaultValue: false,
    },
  },
  PERFORMANCE_METRICS: {
    key: "performance_metrics",
    metadata: {
      name: "Performance Metrics",
      description: "Enables collection and reporting of performance metrics",

      defaultValue: true,
    },
  },
  BETA_FEATURES: {
    key: "beta_features",
    metadata: {
      name: "Beta Features Bundle",
      description: "Enables all current beta features as a bundle",

      defaultValue: true,
    },
  },
  CHARLIE_FEATURES: {
    key: "charlie_features",
    metadata: {
      name: "Charlie Features",
      description: "Legacy feature bundle being phased out",

      defaultValue: true,
    },
  },
};
export type FeatureValue = string | boolean | number;
