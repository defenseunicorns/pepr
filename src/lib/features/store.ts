// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { FeatureFlags, FeatureValue } from "./FeatureFlags";
import { FeatureInfo, FeatureMetadata, FeatureStage, FeaturesDoc } from "./FeatureTypes";

/**
 * Global store for feature flags
 *
 * Uses the Singleton pattern to ensure a single instance is shared across the application
 */
class FeatureStore {
  private featureFlagLimit: number = 4;
  private static instance: FeatureStore;
  private features: Record<string, FeatureValue> = {};
  private currentVersion: string = "0.0.0";

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

    // Parse versions to components and handle prerelease versions
    const parseVersion = (version: string): { parts: number[]; prerelease: string | null } => {
      const [versionPart, prereleasePart] = version.split("-");
      return {
        parts: versionPart.split(".").map(Number),
        prerelease: prereleasePart || null,
      };
    };

    // Compare versions according to semver rules
    const compareVersions = (
      v1: { parts: number[]; prerelease: string | null },
      v2: { parts: number[]; prerelease: string | null },
    ): number => {
      // Compare major.minor.patch
      for (let i = 0; i < 3; i++) {
        if (v1.parts[i] !== v2.parts[i]) {
          return v1.parts[i] > v2.parts[i] ? 1 : -1;
        }
      }

      // If major.minor.patch are equal, check prerelease
      // No prerelease is greater than any prerelease version
      if (v1.prerelease === null && v2.prerelease !== null) return 1;
      if (v1.prerelease !== null && v2.prerelease === null) return -1;
      if (v1.prerelease === v2.prerelease) return 0;

      // Both have prerelease, lexically compare them
      return v1.prerelease! < v2.prerelease! ? -1 : 1;
    };

    const currentV = parseVersion(this.currentVersion);
    const sinceV = parseVersion(metadata.since);

    // Check if current version is at least the 'since' version
    const isSinceConditionMet = compareVersions(currentV, sinceV) >= 0;

    // Check 'until' condition if it exists
    if (metadata.until) {
      const untilV = parseVersion(metadata.until);
      // Feature is available if since condition is met AND current is less than or equal to until
      return isSinceConditionMet && compareVersions(currentV, untilV) <= 0;
    }

    // If no 'until' version, feature is available if since condition is met
    return isSinceConditionMet;
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
    for (const feature of Object.values(FeatureFlags)) {
      if (feature.key === key) {
        return feature.metadata;
      }
    }
    return null;
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
    // Validate semver format (x.y.z)
    const semverRegex = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;
    if (!semverRegex.test(version)) {
      throw new Error(`Invalid version format: ${version}. Must be a valid semver in format x.y.z`);
    }

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

  /**
   * Generate comprehensive documentation for all features
   *
   * @returns Documentation object with current version and feature details
   */
  generateFeaturesDoc(): FeaturesDoc {
    const doc: FeaturesDoc = {
      currentVersion: this.currentVersion,
      features: {},
    };

    Object.values(FeatureFlags).forEach(feature => {
      const isAvailable = this.isFeatureAvailable(feature);
      doc.features[feature.key] = {
        name: feature.metadata.name,
        description: feature.metadata.description,
        stage: feature.metadata.stage,
        since: feature.metadata.since,
        until: feature.metadata.until,
        isAvailable,
        isEnabled: isAvailable && this.isEnabled(feature.key),
        value: this.get(feature.key),
      };
    });

    return doc;
  }

  reset(): void {
    this.features = {};
    this.currentVersion = "0.0.0";
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
