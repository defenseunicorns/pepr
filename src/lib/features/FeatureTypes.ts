import { FeatureValue } from "./FeatureFlags";

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
