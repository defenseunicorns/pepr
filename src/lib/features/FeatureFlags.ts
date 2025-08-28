export interface FeatureMetadata {
  name: string;
  description: string;
  defaultValue: FeatureValue;
}

export interface FeatureInfo {
  key: string;
  metadata: FeatureMetadata;
}
// All known feature flags with their metadata
export const FeatureFlags: Record<string, FeatureInfo> = {
  DEBUG_MODE: {
    key: "debug_mode",
    metadata: {
      name: "Debug Mode",
      description: "Enables verbose logging and debugging features",
      defaultValue: "value",
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
      defaultValue: 42,
    },
  },
};

export type FeatureValue = string | boolean | number;
