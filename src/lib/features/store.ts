// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { FeatureFlags, FeatureMetadata, FeatureValue } from "./FeatureFlags";

/**
 * Global store for feature flags
 *
 * Uses a modified Singleton pattern to ensure a single instance is shared across the application
 * while still allowing for instance creation during testing
 */
export class FeatureStore {
  private featureFlagLimit: number = 4;
  private static instance: FeatureStore;
  private features: Record<string, FeatureValue> = {};
  private featureMetadataMap: Map<string, FeatureMetadata>;

  private constructor() {
    this.featureMetadataMap = new Map();
    Object.values(FeatureFlags).forEach(feature => {
      this.featureMetadataMap.set(feature.key, feature.metadata);
    });
  }

  static getInstance(): FeatureStore {
    if (!FeatureStore.instance) {
      FeatureStore.instance = new FeatureStore();
    }
    return FeatureStore.instance;
  }

  /**
   * Add a feature and handle type conversion
   * @private
   */
  private addFeature(key: string, value: string): void {
    if (!key || value === undefined || value === "") return;

    // Validate against known feature flags
    if (!Object.values(FeatureFlags).some(f => f.key === key)) {
      const knownKeys = Object.values(FeatureFlags)
        .map(f => f.key)
        .join(", ");
      throw new Error(`Unknown feature flag: ${key}. Known flags are: ${knownKeys}`);
    }

    // Type conversion with simplified logic
    const lowerValue = value.toLowerCase();
    this.features[key] =
      lowerValue === "true"
        ? true
        : lowerValue === "false"
          ? false
          : !isNaN(Number(value))
            ? Number(value)
            : value;
  }

  get<T extends FeatureValue>(key: string, defaultValue?: T): T {
    return (this.features[key] as T) ?? defaultValue;
  }

  getFeatureMetadata(key: string): FeatureMetadata | null {
    return this.featureMetadataMap.get(key) || null;
  }

  getAll(): Record<string, FeatureValue> {
    return { ...this.features };
  }

  reset(): void {
    this.features = {};
    this.featureMetadataMap.clear();
    Object.values(FeatureFlags).forEach(feature =>
      this.featureMetadataMap.set(feature.key, feature.metadata),
    );
  }

  /**
   * Initialize features from environment variables and a features string
   */
  initialize(featuresStr?: string): void {
    this.loadFeatures(featuresStr);
    this.validateFeatureCount();
  }

  /**
   * Load feature flags from environment variables and/or a comma-separated string
   * @param featuresStr Optional string in format "feature1=value1,feature2=value2"
   * @private
   */
  private loadFeatures(featuresStr?: string): void {
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

    // Apply default values from FeatureFlags for any flags not explicitly set
    Object.values(FeatureFlags).forEach(feature => {
      if (!(feature.key in this.features)) {
        const defaultValue = feature.metadata.defaultValue;
        this.features[feature.key] = defaultValue;
      }
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
