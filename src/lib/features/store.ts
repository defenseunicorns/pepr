// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { FeatureFlags, FeatureMetadata, FeatureValue } from "./FeatureFlags";

/**
 * Global store for feature flags
 */
export class FeatureStore {
  private featureFlagLimit: number = 4;
  private static instance: FeatureStore;
  private features: Record<string, FeatureValue> = {};
  private featureMetadataMap: Map<string, FeatureMetadata>;

  private constructor() {
    this.initializeMetadata();
  }

  /**
   * Initialize or reset the feature metadata map
   * @private
   */
  private initializeMetadata(): void {
    this.featureMetadataMap = new Map();
    Object.values(FeatureFlags).forEach(feature => {
      this.featureMetadataMap.set(feature.key, feature.metadata);
    });
  }

  /**
   * Get a list of all known feature flag keys
   * @private
   */
  private getKnownFeatureKeys(): string[] {
    return Object.values(FeatureFlags).map(f => f.key);
  }

  /**
   * Validate that a feature key exists in known features
   * @private
   */
  private validateFeatureKey(key: string, throwError = true): boolean {
    const isValid = Object.values(FeatureFlags).some(f => f.key === key);
    if (!isValid && throwError) {
      const knownKeys = this.getKnownFeatureKeys().join(", ");
      throw new Error(`Unknown feature flag: ${key}. Known flags are: ${knownKeys}`);
    }
    return isValid;
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
    this.validateFeatureKey(key);

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

  get<T extends FeatureValue>(key: string): T {
    if (!(key in this.features)) {
      const knownKeys = this.getKnownFeatureKeys().join(", ");
      throw new Error(`Feature flag '${key}' does not exist. Known flags are: ${knownKeys}`);
    }
    return this.features[key] as T;
  }

  getAll(): Record<string, FeatureValue> {
    return { ...this.features };
  }

  reset(): void {
    this.features = {};
    this.initializeMetadata();
  }

  /**
   * Initialize features from environment variables and a features string
   */
  initialize(featuresStr?: string): void {
    this.loadFeatures(featuresStr);

    // Validate feature count
    const featureCount = Object.keys(this.features).length;
    if (featureCount > this.featureFlagLimit) {
      throw new Error(
        `Too many feature flags active: ${featureCount} (maximum: ${this.featureFlagLimit}). Use of more than ${this.featureFlagLimit} feature flags is not supported.`,
      );
    }
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
    Object.values(FeatureFlags)
      .filter(feature => feature?.metadata?.defaultValue !== undefined)
      .forEach(feature => {
        if (!(feature.key in this.features)) {
          this.features[feature.key] = feature.metadata.defaultValue;
        }
      });
  }
}

export const featureFlagStore = FeatureStore.getInstance();
