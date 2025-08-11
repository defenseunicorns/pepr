// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

/**
 * Feature flags store for Pepr CLI
 *
 * This module provides a singleton feature store that can be accessed from
 * anywhere in the CLI application to check feature flag values.
 */

type FeatureValue = string | boolean | number;

/**
 * Global store for feature flags
 *
 * Uses the Singleton pattern to ensure a single instance is shared across the application
 */
class FeatureStore {
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
   */
  private addFeature(key: string, value: string): void {
    if (!key || value === undefined || value === "") return;

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
   * @param key The feature key to retrieve
   * @param defaultValue Optional default value if feature is not set
   * @returns The feature value with correct type, or defaultValue if not found
   */
  get<T extends FeatureValue>(key: string, defaultValue?: T): T {
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
   *
   * @param featuresStr Optional comma-separated feature string in format "feature1=value1,feature2=value2"
   */
  initialize(featuresStr?: string): void {
    // First load from environment variables
    Object.entries(process.env).forEach(([key, value]) => {
      if (key.startsWith("PEPR_FEATURE_")) {
        const featureName = key.replace("PEPR_FEATURE_", "").toLowerCase();
        if (value) {
          // Don't validate for each env var
          this.addFeature(featureName, value);
        }
      }
    });

    // Then load from features string (will override env vars with same keys)
    if (featuresStr) {
      featuresStr.split(",").forEach(feature => {
        const [key, value] = feature.split("=");
        // CLI features override environment variables
        this.addFeature(key, value);
      });
    }

    // Validate once after all features are processed if requested
    this.validateFeatureCount();
  }

  /**
   * Validates that no more than 4 feature flags are active
   *
   * @throws Error if more than 4 feature flags are active
   */
  validateFeatureCount(): void {
    const featureCount = Object.keys(this.features).length;
    if (featureCount > 4) {
      throw new Error(`Too many feature flags active: ${featureCount} (maximum: 4)`);
    }
  }
}

// Export a singleton instance
export const featureStore = FeatureStore.getInstance();
