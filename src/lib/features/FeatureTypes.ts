import { FeatureValue } from "./FeatureFlags";

/**
 * Feature lifecycle stages
 */

export enum FeatureStage {
  /**
   * Alpha features are early/experimental
   * - Disabled by default
   * - May contain bugs or be incomplete
   * - May change significantly or be removed
   * - Not recommended for production
   */
  ALPHA = "alpha",

  /**
   * Beta features are maturing but not fully stable
   * - Enabled by default
   * - Better tested but may still have issues
   * - API may still undergo minor changes
   * - Use with caution in production
   */
  BETA = "beta",

  /**
   * GA (General Availability) features are stable
   * - Always enabled (when available in current version)
   * - API is stable and maintained
   * - Suitable for production use
   */
  GA = "ga",
}
/**
 * Metadata for a feature flag
 */

export interface FeatureMetadata {
  /** Human-readable name of the feature */
  name: string;

  /** Description of what the feature does */
  description: string;

  /** The feature's lifecycle stage */
  stage: FeatureStage;

  /** Semver version when the feature was introduced */
  since: string;

  /**
   * Semver version when the feature will be removed
   * null means no planned removal
   */
  until: string | null;

  /** Default value based on stage if not explicitly set */
  defaultValue: boolean;
}
/**
 * Information about a feature including its key and metadata
 */

export interface FeatureInfo {
  key: string;
  metadata: FeatureMetadata;
}
/**
 * Feature documentation structure
 */

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
