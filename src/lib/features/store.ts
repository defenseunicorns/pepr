// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { FeatureFlags, FeatureValue } from "./FeatureFlags";

/**
 * Global store for feature flags
 */
export class FeatureStore {
  private featureFlagLimit: number = 4;
  private static instance: FeatureStore;
  private features: Record<string, FeatureValue> = {};

  private constructor() {
    // No initialization needed
  }

  static getInstance(): FeatureStore {
    if (!FeatureStore.instance) {
      FeatureStore.instance = new FeatureStore();
    }
    return FeatureStore.instance;
  }

  /**
   * Get all valid feature flag keys
   * @private
   * @static
   * @returns Array of valid feature flag keys
   */
  private static getValidFeatureKeys(): string[] {
    return Object.values(FeatureFlags)
      .filter(f => f?.key)
      .map(f => f.key);
  }

  /**
   * Validates if a feature flag key is known
   * @private
   * @static
   */
  private static validateFeatureKey(key: string): void {
    const validKeys = FeatureStore.getValidFeatureKeys();

    if (!validKeys.includes(key)) {
      throw new Error(`Unknown feature flag: ${key}. Known flags are: ${validKeys.join(", ")}`);
    }
  }

  /**
   * Add a feature and handle type conversion
   * @private
   */
  private addFeature(key: string, value: string): void {
    if (!key || value === undefined || value === "") return;

    // Validate against known feature flags
    FeatureStore.validateFeatureKey(key);

    // Simple type conversion
    const lowerValue = value.toLowerCase();

    if (lowerValue === "true") {
      this.features[key] = true;
    } else if (lowerValue === "false") {
      this.features[key] = false;
    } else if (!isNaN(Number(value))) {
      this.features[key] = Number(value);
    } else {
      this.features[key] = value;
    }
  }

  get<T extends FeatureValue>(key: string): T {
    // Validate key is known first
    FeatureStore.validateFeatureKey(key);

    if (!(key in this.features)) {
      const knownKeys = Object.values(FeatureFlags)
        .map(f => f.key)
        .join(", ");
      throw new Error(`Feature flag '${key}' does not exist. Known flags are: ${knownKeys}`);
    }
    return this.features[key] as T;
  }

  getAll(): Record<string, FeatureValue> {
    return { ...this.features };
  }

  reset(): void {
    this.features = {};
  }

  /**
   * Initialize features from environment variables and/or a features string
   * @param featuresStr Optional string in format "feature1=value1,feature2=value2"
   */
  initialize(featuresStr?: string): void {
    // Clear existing features
    this.reset();

    // Process environment variables
    Object.keys(process.env)
      .filter(key => key.startsWith("PEPR_FEATURE_"))
      .forEach(key => {
        const featureKey = key.replace("PEPR_FEATURE_", "").toLowerCase();
        this.addFeature(featureKey, process.env[key] || "");
      });

    // Process initialization string if provided
    if (featuresStr) {
      featuresStr
        .split(",")
        .map(feature => feature.split("="))
        .filter(parts => parts.length === 2)
        .forEach(([key, value]) => {
          this.addFeature(key.trim(), value.trim());
        });
    }

    // Apply default values for any feature flags not explicitly set
    this.applyDefaultValues();

    // Check feature count limit
    this.validateFeatureCount();
  }

  /**
   * Apply default values from FeatureFlags for any flags not explicitly set
   * @private
   */
  private applyDefaultValues(): void {
    Object.values(FeatureFlags)
      .filter(
        feature =>
          feature?.key &&
          feature?.metadata?.defaultValue !== undefined &&
          !(feature.key in this.features),
      )
      .forEach(feature => {
        this.features[feature.key] = feature.metadata.defaultValue;
      });
  }

  validateFeatureCount(): void {
    const featureCount = Object.keys(this.features).length;
    if (featureCount > this.featureFlagLimit) {
      throw new Error(
        `Too many feature flags active: ${featureCount} (maximum: ${this.featureFlagLimit}). Use of more than ${this.featureFlagLimit} feature flags is not supported.`,
      );
    }
  }
}

export const featureFlagStore = FeatureStore.getInstance();
