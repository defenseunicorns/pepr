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
  REFERENCE_FLAG: {
    key: "reference_flag",
    metadata: {
      name: "Reference Flag",
      description: "A feature flag to show intended usage.",
      defaultValue: false,
    },
  },
};

export type FeatureValue = string | boolean | number;
