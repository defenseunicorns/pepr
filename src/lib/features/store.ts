// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { FeatureFlags, FeatureValue } from "./FeatureFlags";
import { FeatureInfo, FeatureMetadata, FeatureStage } from "./FeatureTypes";
import * as VersionUtils from "./VersionUtils";

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
  private currentVersion: string = "0.0.0";
  private featureMetadataMap: Map<string, FeatureMetadata>;

  private constructor() {
    // Initialize feature metadata map for O(1) lookups
    this.featureMetadataMap = new Map();
    Object.values(FeatureFlags).forEach(feature => {
      this.featureMetadataMap.set(feature.key, feature.metadata);
    });
  }

  /**
   * Gets the singleton instance
   *
   * @returns The singleton instance of FeatureStore
   */
  static getInstance(): FeatureStore {
    if (!FeatureStore.instance) {
      FeatureStore.instance = new FeatureStore();
    }
    return FeatureStore.instance;
  }

  /**
   * Creates a new instance of FeatureStore
   * This should only be used for testing purposes
   *
   * @returns A new instance of FeatureStore
   */
  static createInstance(): FeatureStore {
    return new FeatureStore();
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
    const knownKeys = Object.values(FeatureFlags).map(f => f.key);
    if (!knownKeys.includes(key)) {
      throw new Error(`Unknown feature flag: ${key}. Known flags are: ${knownKeys.join(", ")}`);
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
   * Checks if a feature is available based on the current version
   * A feature is available if the current version is:
   * - Greater than or equal to the 'since' version
   * - Less than the 'until' version (if specified)
   *
   * @param key Feature flag key or feature info object
   * @returns boolean indicating if the feature is available in the current version
   */
  isFeatureAvailable(feature: string | FeatureInfo): boolean {
    const metadata =
      typeof feature === "string" ? this.getFeatureMetadata(feature) : feature.metadata;

    if (!metadata) return false;

    return VersionUtils.isVersionInRange(this.currentVersion, metadata.since, metadata.until);
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
   * Check if a feature is enabled, considering both:
   * 1. Version availability (based on since/until)
   * 2. Explicit settings or stage-based defaults
   *
   * @param key The feature key to check
   * @returns boolean indicating if the feature is enabled
   */
  isEnabled(key: string): boolean {
    const metadata = this.getFeatureMetadata(key);
    if (!metadata) return false;

    // First check if feature is available in current version
    if (!this.isFeatureAvailable(key)) return false;

    // Check if explicitly set
    if (key in this.features) {
      return Boolean(this.features[key]);
    }

    // Use default based on stage
    return metadata.defaultValue;
  }

  /**
   * Get metadata for a feature flag
   *
   * @param key The feature key
   * @returns FeatureMetadata or null if not found
   */
  getFeatureMetadata(key: string): FeatureMetadata | null {
    return this.featureMetadataMap.get(key) || null;
  }

  getAll(): Record<string, FeatureValue> {
    return { ...this.features };
  }

  /**
   * Get the current version
   *
   * @returns The current version string
   */
  getVersion(): string {
    return this.currentVersion;
  }

  /**
   * Set the current version
   *
   * @param version Semver string in format x.y.z
   * @throws Error if version format is invalid
   */
  setVersion(version: string): void {
    VersionUtils.validateVersion(version);
    this.currentVersion = version;
  }

  /**
   * Get all features of a specific stage
   *
   * @param stage The feature stage to filter by
   * @returns Array of feature info objects matching the stage
   */
  getFeaturesByStage(stage: FeatureStage): FeatureInfo[] {
    return Object.values(FeatureFlags).filter(feature => feature.metadata.stage === stage);
  }

  /**
   * Get all features available in the current version
   *
   * @returns Array of feature info objects available in current version
   */
  getAvailableFeatures(): FeatureInfo[] {
    return Object.values(FeatureFlags).filter(feature => this.isFeatureAvailable(feature));
  }

  reset(): void {
    this.features = {};
    this.currentVersion = "0.0.0";

    // Re-initialize feature metadata map
    this.featureMetadataMap.clear();
    Object.values(FeatureFlags).forEach(feature => {
      this.featureMetadataMap.set(feature.key, feature.metadata);
    });
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
    this.loadFromEnvironment();

    // Then load from features string (will override env vars with same keys)
    if (featuresStr) {
      this.loadFromString(featuresStr);
    }

    // Validate once after all features are processed
    this.validateFeatureCount();
  }

  /**
   * Load feature flags from environment variables
   * Environment variables should be in the format PEPR_FEATURE_{FEATURE_NAME}
   */
  private loadFromEnvironment(): void {
    Object.entries(process.env).forEach(([key, value]) => {
      if (key.startsWith("PEPR_FEATURE_")) {
        const featureName = key.replace("PEPR_FEATURE_", "").toLowerCase();
        if (value) {
          this.addFeature(featureName, value);
        }
      }
    });
  }

  /**
   * Load feature flags from a comma-separated string
   * @param featuresStr String in format "feature1=value1,feature2=value2"
   */
  private loadFromString(featuresStr: string): void {
    featuresStr.split(",").forEach(feature => {
      const [key, value] = feature.split("=");
      if (key && value) {
        // Override environment variables with same key
        this.addFeature(key, value);
      }
    });
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
/**
 * Default singleton instance of FeatureStore for backward compatibility
 */
export const store = FeatureStore.getInstance();
