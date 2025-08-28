// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { FeatureFlags, FeatureValue } from "./FeatureFlags";

export class FeatureStore {
  private featureFlagLimit: number = 4;
  private features: Record<string, FeatureValue> = {};

  private addFeature(key: string, value: string): void {
    if (!key || value === undefined || value === "") return;

    const validKeys = Object.values(FeatureFlags)
      .filter(f => f?.key)
      .map(f => f.key);
    if (!validKeys.includes(key)) {
      throw new Error(`Unknown feature flag: ${key}`);
    }

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
    if (!Object.values(FeatureFlags).some(f => f?.key === key)) {
      throw new Error(`Unknown feature flag: ${key}`);
    }

    if (!(key in this.features)) {
      throw new Error(`Feature flag '${key}' exists but has not been set`);
    }

    return this.features[key] as T;
  }

  getAll(): Record<string, FeatureValue> {
    return { ...this.features };
  }

  initialize(featuresStr?: string, env: Record<string, string | undefined> = process.env): void {
    Object.keys(env)
      .filter(key => key.startsWith("PEPR_FEATURE_"))
      .forEach(key => {
        this.addFeature(key.replace("PEPR_FEATURE_", "").toLowerCase(), env[key] || "");
      });

    if (featuresStr) {
      featuresStr
        .split(",")
        .map(feature => feature.split("="))
        .filter(parts => parts.length === 2)
        .forEach(([key, value]) => {
          this.addFeature(key.trim(), value.trim());
        });
    }

    this.applyDefaultValues();
    this.validateFeatureCount();
  }

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

export const featureFlagStore = new FeatureStore();
