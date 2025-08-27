// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

/**
 * Enum of all known feature flags supported by Pepr
 */
export enum KnownFeatureFlag {
  DEBUG_MODE = "debug_mode",
  EXPERIMENTAL_API = "experimental_api",
  PERFORMANCE_METRICS = "performance_metrics",
  BETA_FEATURES = "beta_features",
  CHARLIE_FEATURES = "charlie_features",
}

type FeatureValue = string | boolean | number;

/**
 * Global store for feature flags
 *
 * Uses the Singleton pattern to ensure a single instance is shared across the application
 */
class FeatureStore {
  private featureFlagLimit: number = 4;
  private static instance: FeatureStore;
  private features: Record<string, FeatureValue> = {};

  private constructor() {}

  /**
   * Get the singleton instance of the feature store
   */
  static getInstance(): FeatureStore {
    if (!FeatureStore.instance) {
      FeatureStore.instance = new FeatureStore();
    }
    return FeatureStore.instance;
  }

  /**
   * Private method to add a feature and handle type conversion
   *
   * @param key The feature key
   * @param value The feature value as string
   * @throws Error if the feature key is not a known feature flag
   */
  private addFeature(key: string, value: string): void {
    if (!key || value === undefined || value === "") return;

    // Validate against known feature flags
    if (!Object.values(KnownFeatureFlag).includes(key as KnownFeatureFlag)) {
      throw new Error(
        `Unknown feature flag: ${key}. Known flags are: ${Object.values(KnownFeatureFlag).join(", ")}`,
      );
    }

    // Attempt type conversion
    if (value.toLowerCase() === "true") {
      this.features[key] = true;
    } else if (value.toLowerCase() === "false") {
      this.features[key] = false;
    } else if (!isNaN(Number(value))) {
      this.features[key] = Number(value);
    } else {
      this.features[key] = value;
    }
  }

  /**
   * Get a feature value by key with type safety
   *
   * @param key The feature key to retrieve (should be a KnownFeatureFlag)
   * @param defaultValue Optional default value if feature is not set
   * @returns The feature value with correct type, or defaultValue if not found
   */
  get<T extends FeatureValue>(key: KnownFeatureFlag | string, defaultValue?: T): T {
    return (this.features[key] as T) ?? defaultValue;
  }

  getAll(): Record<string, FeatureValue> {
    return { ...this.features };
  }

  reset(): void {
    this.features = {};
  }

  debug(): string {
    return JSON.stringify(this.features, null, 2);
  }

  /**
   * Initialize features from both environment variables and a features string
   *
   * Command-line features (provided in the featuresStr) take precedence over environment variables.
   * All feature flags must be defined in KnownFeatureFlag enum.
   *
   * @param featuresStr Optional comma-separated feature string in format "feature1=value1,feature2=value2"
   * @throws Error if an unknown feature flag is provided
   */
  initialize(featuresStr?: string): void {
    // First load from environment variables
    Object.entries(process.env).forEach(([key, value]) => {
      if (key.startsWith("PEPR_FEATURE_")) {
        const featureName = key.replace("PEPR_FEATURE_", "").toLowerCase();
        if (value) {
          // Validate against known feature flags
          this.addFeature(featureName, value);
        }
      }
    });

    // Then load from features string (will override env vars with same keys)
    if (featuresStr) {
      featuresStr.split(",").forEach(feature => {
        const [key, value] = feature.split("=");
        if (key && value) {
          // Override environment variables with same key
          this.addFeature(key, value);
        }
      });
    }

    // Validate once after all features are processed
    this.validateFeatureCount();
  }

  /**
   * Validates that no more than `featureFlagLimit` feature flags are active
   *
   * @throws Error if more than `featureFlagLimit` feature flags are active
   */
  validateFeatureCount(): void {
    const featureCount = Object.keys(this.features).length;
    if (featureCount > this.featureFlagLimit) {
      throw new Error(
        `Too many feature flags active: ${featureCount} (maximum: ${this.featureFlagLimit}). Use of more than ${this.featureFlagLimit} feature flags is not supported due to complexity concerns.`,
      );
    }
  }
}

// Export a singleton instance
export const featureFlagStore = FeatureStore.getInstance();
