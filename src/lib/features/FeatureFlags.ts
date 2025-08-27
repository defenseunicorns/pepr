import { FeatureInfo, FeatureStage } from "./FeatureTypes";

/**
 * All known feature flags with their metadata
 */

export const FeatureFlags: Record<string, FeatureInfo> = {
  DEBUG_MODE: {
    key: "debug_mode",
    metadata: {
      name: "Debug Mode",
      description: "Enables verbose logging and debugging features",
      stage: FeatureStage.GA,
      since: "1.0.0",
      until: null,
      defaultValue: true,
    },
  },
  EXPERIMENTAL_API: {
    key: "experimental_api",
    metadata: {
      name: "Experimental API",
      description: "Enables experimental APIs that may change",
      stage: FeatureStage.ALPHA,
      since: "1.2.0",
      until: null,
      defaultValue: false,
    },
  },
  PERFORMANCE_METRICS: {
    key: "performance_metrics",
    metadata: {
      name: "Performance Metrics",
      description: "Enables collection and reporting of performance metrics",
      stage: FeatureStage.BETA,
      since: "1.1.0",
      until: null,
      defaultValue: true,
    },
  },
  BETA_FEATURES: {
    key: "beta_features",
    metadata: {
      name: "Beta Features Bundle",
      description: "Enables all current beta features as a bundle",
      stage: FeatureStage.BETA,
      since: "1.0.0",
      until: null,
      defaultValue: true,
    },
  },
  CHARLIE_FEATURES: {
    key: "charlie_features",
    metadata: {
      name: "Charlie Features",
      description: "Legacy feature bundle being phased out",
      stage: FeatureStage.GA,
      since: "1.3.0",
      until: "1.9.0",
      defaultValue: true,
    },
  },
};
export type FeatureValue = string | boolean | number;
