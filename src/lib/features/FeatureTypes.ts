import { FeatureValue } from "./FeatureFlags";

export interface FeatureMetadata {
  name: string;
  description: string;
  defaultValue: boolean;
}

export interface FeatureInfo {
  key: string;
  metadata: FeatureMetadata;
}

export interface FeaturesDoc {
  currentVersion: string;
  features: Record<
    string,
    {
      name: string;
      description: string;
      stage: string;
      since: string;
      until: string | null;
      isAvailable: boolean;
      isEnabled: boolean;
      value: FeatureValue | undefined;
    }
  >;
}
