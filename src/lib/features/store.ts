// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

/**
 * Feature flags store for Pepr CLI
 *
 * This module provides a singleton feature store that can be accessed from
 * anywhere in the CLI application to check feature flag values.
 */

export type FeatureValue = string | boolean | number;

/**
 * Global store for feature flags
 *
 * Uses the Singleton pattern to ensure a single instance is shared across the application
 */
export class FeatureStore {
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
   * Parse a features string in the format "feature1=value1,feature2=value2"
   * and populate the feature store
   *
   * @param featuresStr The feature string to parse
   */
  parseFromString(featuresStr?: string): void {
    if (!featuresStr) return;

    featuresStr.split(",").forEach(feature => {
      const [key, value] = feature.split("=");
      // Skip entries with empty key or empty/undefined value
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
    });

    // Validate feature count after adding new features
    this.validateFeatureCount();
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

  /**
   * Get all feature flags
   *
   * @returns A copy of all feature flags
   */
  getAll(): Record<string, FeatureValue> {
    return { ...this.features };
  }

  /**
   * Check if a feature exists
   *
   * @param key The feature key to check
   * @returns True if the feature exists
   */
  hasFeature(key: string): boolean {
    return key in this.features;
  }

  /**
   * Reset all features
   *
   * Useful primarily for testing
   */
  reset(): void {
    this.features = {};
  }

  /**
   * Log all features for debugging
   *
   * @returns A JSON string of all features
   */
  debug(): string {
    return JSON.stringify(this.features, null, 2);
  }

  /**
   * Initialize features from environment variables
   *
   * Loads any environment variable starting with PEPR_FEATURE_
   */
  initFromEnv(): void {
    Object.entries(process.env).forEach(([key, value]) => {
      if (key.startsWith("PEPR_FEATURE_")) {
        const featureName = key.replace("PEPR_FEATURE_", "").toLowerCase();
        if (value) {
          this.parseFromString(`${featureName}=${value}`);
        }
      }
    });
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
