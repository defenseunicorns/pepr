// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { featureFlagStore, FeatureFlags, FeatureStage } from "./store";
import { describe, beforeEach, it, expect } from "vitest";

describe("FeatureStore", () => {
  beforeEach(() => {
    featureFlagStore.reset();
    // Reset the version back to default for tests not related to versioning
    if (featureFlagStore.setVersion) {
      featureFlagStore.setVersion("0.0.0");
    }
  });

  describe("when accessing features", () => {
    beforeEach(() => {
      featureFlagStore.initialize(
        `${FeatureFlags.DEBUG_MODE.key}=value,${FeatureFlags.PERFORMANCE_METRICS.key}=42,${FeatureFlags.BETA_FEATURES.key}=true`,
      );
    });

    describe("which exist", () => {
      it.each([
        { type: "string", key: FeatureFlags.DEBUG_MODE.key, expected: "value" },
        { type: "number", key: FeatureFlags.PERFORMANCE_METRICS.key, expected: 42 },
        { type: "boolean", key: FeatureFlags.BETA_FEATURES.key, expected: true },
      ])("should return $type values", ({ key, expected }) => {
        expect(featureFlagStore.get<typeof expected>(key)).toBe(expected);
      });
    });

    describe("with non-existent features", () => {
      it.each([
        { type: "string", defaultValue: "default", expected: "default" },
        { type: "number", defaultValue: 100, expected: 100 },
        { type: "boolean", defaultValue: false, expected: false },
      ])("should return default $type value", ({ defaultValue, expected }) => {
        // Using a flag we know doesn't exist in our initialized set
        expect(featureFlagStore.get(FeatureFlags.EXPERIMENTAL_API.key, defaultValue)).toBe(
          expected,
        );
      });

      it("should return undefined without default", () => {
        // Using a flag we know doesn't exist in our initialized set
        expect(featureFlagStore.get(FeatureFlags.EXPERIMENTAL_API.key)).toBeUndefined();
      });
    });

    it("should return a copy of all features", () => {
      const features = featureFlagStore.getAll();
      expect(features).toEqual({
        [FeatureFlags.DEBUG_MODE.key]: "value",
        [FeatureFlags.PERFORMANCE_METRICS.key]: 42,
        [FeatureFlags.BETA_FEATURES.key]: true,
      });

      // Verify it's a copy by modifying the returned object
      features[FeatureFlags.DEBUG_MODE.key] = "modified";
      expect(featureFlagStore.get(FeatureFlags.DEBUG_MODE.key)).toBe("value"); // Original remains unchanged
    });
  });

  describe("when initializing the feature-flag store", () => {
    it.each([
      {
        name: "should load features from environment variables when no string is provided",
        envVars: {
          [`PEPR_FEATURE_${FeatureFlags.DEBUG_MODE.key.toUpperCase()}`]: "true",
          [`PEPR_FEATURE_${FeatureFlags.PERFORMANCE_METRICS.key.toUpperCase()}`]: "42",
          [`PEPR_FEATURE_${FeatureFlags.EXPERIMENTAL_API.key.toUpperCase()}`]: "value",
        },
        initializeString: undefined,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: true,
          [FeatureFlags.PERFORMANCE_METRICS.key]: 42,
          [FeatureFlags.EXPERIMENTAL_API.key]: "value",
        },
      },
      {
        name: "should parse string values",
        envVars: {},
        initializeString: `${FeatureFlags.DEBUG_MODE.key}=value,${FeatureFlags.EXPERIMENTAL_API.key}=advanced`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: "value",
          [FeatureFlags.EXPERIMENTAL_API.key]: "advanced",
        },
      },
      {
        name: "should parse boolean values",
        envVars: {},
        initializeString: `${FeatureFlags.DEBUG_MODE.key}=true,${FeatureFlags.EXPERIMENTAL_API.key}=false`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: true,
          [FeatureFlags.EXPERIMENTAL_API.key]: false,
        },
      },
      {
        name: "should parse numeric values",
        envVars: {},
        initializeString: `${FeatureFlags.DEBUG_MODE.key}=5,${FeatureFlags.EXPERIMENTAL_API.key}=10.5`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: 5,
          [FeatureFlags.EXPERIMENTAL_API.key]: 10.5,
        },
      },
      {
        name: "should handle empty initialization strings",
        envVars: {},
        initializeString: "",
        expectedFeatures: {},
      },
      {
        name: "should handle malformed entries",
        envVars: {},
        initializeString: `${FeatureFlags.DEBUG_MODE.key}=true,novalue=,=noproperty,invalid`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: true,
        },
      },
      {
        name: "should load features from string when no env vars are present",
        envVars: {},
        initializeString: `${FeatureFlags.DEBUG_MODE.key}=true,${FeatureFlags.PERFORMANCE_METRICS.key}=42,${FeatureFlags.EXPERIMENTAL_API.key}=value`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: true,
          [FeatureFlags.PERFORMANCE_METRICS.key]: 42,
          [FeatureFlags.EXPERIMENTAL_API.key]: "value",
        },
      },
      {
        name: "should allow CLI features to override environment variables",
        envVars: {
          [`PEPR_FEATURE_${FeatureFlags.DEBUG_MODE.key.toUpperCase()}`]: "true",
          [`PEPR_FEATURE_${FeatureFlags.PERFORMANCE_METRICS.key.toUpperCase()}`]: "42",
          [`PEPR_FEATURE_${FeatureFlags.EXPERIMENTAL_API.key.toUpperCase()}`]: "value",
        },
        initializeString: `${FeatureFlags.PERFORMANCE_METRICS.key}=99,${FeatureFlags.BETA_FEATURES.key}=new`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: true, // From env
          [FeatureFlags.PERFORMANCE_METRICS.key]: 99, // Overridden by CLI
          [FeatureFlags.EXPERIMENTAL_API.key]: "value", // From env
          [FeatureFlags.BETA_FEATURES.key]: "new", // From CLI
        },
      },
    ])("$name", ({ envVars, initializeString, expectedFeatures }) => {
      // Save original process.env
      const originalEnv = { ...process.env };
      try {
        // Set environment variables
        Object.entries(envVars).forEach(([key, value]) => {
          process.env[key] = value;
        });

        // Initialize with provided string
        featureFlagStore.initialize(initializeString);

        Object.entries(expectedFeatures).forEach(([key, value]) => {
          expect(featureFlagStore.get(key)).toBe(value);
        });
      } finally {
        // Restore original process.env
        process.env = originalEnv;
      }
    });

    it("should enforce feature count validation", () => {
      // Save original process.env
      const originalEnv = { ...process.env };
      try {
        // Set 3 env variables
        process.env[`PEPR_FEATURE_${FeatureFlags.DEBUG_MODE.key.toUpperCase()}`] = "true";
        process.env[`PEPR_FEATURE_${FeatureFlags.PERFORMANCE_METRICS.key.toUpperCase()}`] = "42";
        process.env[`PEPR_FEATURE_${FeatureFlags.EXPERIMENTAL_API.key.toUpperCase()}`] = "value";

        // Add 2 more via string to exceed the 4 feature limit
        expect(() => {
          featureFlagStore.initialize(
            `${FeatureFlags.BETA_FEATURES.key}=new,${FeatureFlags.CHARLIE_FEATURES.key}=extra`,
          );
        }).toThrow("Too many feature flags active: 5 (maximum: 4)");
      } finally {
        // Restore original process.env
        process.env = originalEnv;
      }
    });
  });

  // New tests specifically for feature flag validation
  describe("when validating feature flags", () => {
    it("should accept known feature flags", () => {
      featureFlagStore.initialize(`${FeatureFlags.DEBUG_MODE.key}=true`);
      expect(featureFlagStore.get(FeatureFlags.DEBUG_MODE.key)).toBe(true);
    });

    it("should throw error for unknown feature flags", () => {
      expect(() => {
        featureFlagStore.initialize("unknown_flag=value");
      }).toThrow("Unknown feature flag: unknown_flag");
    });

    it("should validate flags from environment variables", () => {
      const originalEnv = { ...process.env };
      try {
        process.env.PEPR_FEATURE_UNKNOWN = "value";
        expect(() => {
          featureFlagStore.initialize();
        }).toThrow("Unknown feature flag: unknown");
      } finally {
        process.env = originalEnv;
      }
    });

    it("should provide type safety when accessing features", () => {
      featureFlagStore.initialize(`${FeatureFlags.BETA_FEATURES.key}=true`);
      const value: boolean = featureFlagStore.get(FeatureFlags.BETA_FEATURES.key);
      expect(value).toBe(true);
    });
  });

  // Tests for the enhanced version metadata functionality
  describe("when managing versions", () => {
    beforeEach(() => {
      featureFlagStore.reset();
    });

    describe("version validation", () => {
      it("should accept valid semver format", () => {
        expect(() => featureFlagStore.setVersion("1.0.0")).not.toThrow();
        expect(() => featureFlagStore.setVersion("0.1.0")).not.toThrow();
        expect(() => featureFlagStore.setVersion("1.2.3")).not.toThrow();
        expect(() => featureFlagStore.setVersion("1.0.0-alpha")).not.toThrow();
        expect(() => featureFlagStore.setVersion("1.0.0-nightly.1")).not.toThrow();
      });

      it("should reject invalid version formats", () => {
        expect(() => featureFlagStore.setVersion("1.0")).toThrow();
        expect(() => featureFlagStore.setVersion("v1.0.0")).toThrow();
        expect(() => featureFlagStore.setVersion("latest")).toThrow();
      });
    });

    describe("version setting and getting", () => {
      it("should store and retrieve the set version", () => {
        featureFlagStore.setVersion("1.2.3");
        expect(featureFlagStore.getVersion()).toBe("1.2.3");

        featureFlagStore.setVersion("2.0.0");
        expect(featureFlagStore.getVersion()).toBe("2.0.0");
      });

      it("should have a default version when not explicitly set", () => {
        // Reset should set to default version
        featureFlagStore.reset();
        expect(featureFlagStore.getVersion()).toBe("0.0.0");
      });
    });
  });

  describe("when using version-based availability", () => {
    beforeEach(() => {
      featureFlagStore.reset();
    });

    describe("with sinceVersion", () => {
      // Assume EXPERIMENTAL_API has sinceVersion: "1.2.0"
      it.each([
        {
          version: "1.2.0",
          expected: true,
          description: "should enable when version equals sinceVersion",
        },
        {
          version: "1.3.0",
          expected: true,
          description: "should enable when version is greater than sinceVersion",
        },
        {
          version: "1.1.0",
          expected: false,
          description: "should disable when version is less than sinceVersion",
        },
        {
          version: "1.2.0-alpha.1",
          expected: false,
          description: "should handle pre-release versions correctly",
        },
      ])("$description", ({ version, expected }) => {
        // Initialize the feature with a value of true before testing
        featureFlagStore.initialize(`${FeatureFlags.EXPERIMENTAL_API.key}=true`);
        featureFlagStore.setVersion(version);
        expect(featureFlagStore.isEnabled(FeatureFlags.EXPERIMENTAL_API.key)).toBe(expected);
      });
    });

    describe("with untilVersion", () => {
      // Assume LEGACY_API has untilVersion: "1.9.0"
      it.each([
        {
          version: "1.8.0",
          expected: true,
          description: "should enable when version is less than untilVersion",
        },
        {
          version: "1.9.0",
          expected: true,
          description: "should enable when version equals untilVersion",
        },
        {
          version: "1.10.0",
          expected: false,
          description: "should disable when version is greater than untilVersion",
        },
        {
          version: "1.9.0-beta.1",
          expected: true,
          description: "should handle pre-release versions correctly",
        },
      ])("$description", ({ version, expected }) => {
        featureFlagStore.setVersion(version);
        expect(featureFlagStore.isEnabled(FeatureFlags.CHARLIE_FEATURES.key)).toBe(expected);
      });
    });
  });

  describe("when checking feature availability based on version", () => {
    beforeEach(() => {
      featureFlagStore.reset();
    });

    describe("until version testing", () => {
      it("should handle null until version", () => {
        // Assuming DEBUG_MODE has until=null
        featureFlagStore.setVersion("999.999.999"); // Very high version
        expect(featureFlagStore.isFeatureAvailable(FeatureFlags.DEBUG_MODE.key)).toBe(true);
      });
    });

    describe("version change impact", () => {
      it.each([
        {
          scenario: "feature becomes available",
          flag: FeatureFlags.EXPERIMENTAL_API.key,
          initialVersion: "1.0.0",
          initialExpectation: false,
          newVersion: "1.3.0",
          finalExpectation: true,
        },
        {
          scenario: "feature becomes unavailable",
          flag: FeatureFlags.CHARLIE_FEATURES.key,
          initialVersion: "1.5.0",
          initialExpectation: true,
          newVersion: "2.0.0",
          finalExpectation: false,
        },
      ])(
        "should handle $scenario",
        ({ flag, initialVersion, initialExpectation, newVersion, finalExpectation }) => {
          // Setup with feature in its initial version
          featureFlagStore.setVersion(initialVersion);
          featureFlagStore.initialize(`${flag}=true`);
          expect(featureFlagStore.isEnabled(flag)).toBe(initialExpectation);

          // Change to new version
          featureFlagStore.setVersion(newVersion);
          expect(featureFlagStore.isEnabled(flag)).toBe(finalExpectation);
        },
      );
    });
  });

  describe("when managing features based on stage", () => {
    beforeEach(() => {
      featureFlagStore.reset();
      featureFlagStore.setVersion("1.5.0"); // Version where all features should be available
    });

    it.each([
      {
        stageName: "Alpha features",
        flag: FeatureFlags.EXPERIMENTAL_API.key,
        defaultValue: false,
        description: "should be disabled by default but can be enabled",
      },
      {
        stageName: "Beta features",
        flag: FeatureFlags.PERFORMANCE_METRICS.key,
        defaultValue: true,
        description: "should be enabled by default but can be disabled",
      },
      {
        stageName: "GA features",
        flag: FeatureFlags.DEBUG_MODE.key,
        defaultValue: true,
        description: "should be enabled by default but can be disabled",
      },
    ])("$stageName: $description", ({ flag, defaultValue }) => {
      // Test default value
      expect(featureFlagStore.isEnabled(flag)).toBe(defaultValue);

      // Test explicit override
      featureFlagStore.initialize(`${flag}=${!defaultValue}`);
      expect(featureFlagStore.isEnabled(flag)).toBe(!defaultValue);
    });
  });

  describe("when using feature utility methods", () => {
    beforeEach(() => {
      featureFlagStore.reset();
      featureFlagStore.setVersion("1.5.0"); // Version where all features should be available
    });

    describe("getFeaturesByStage", () => {
      it.each([
        { stageName: "ALPHA", stage: FeatureStage.ALPHA },
        { stageName: "BETA", stage: FeatureStage.BETA },
        { stageName: "GA", stage: FeatureStage.GA },
      ])("should return features for $stageName stage", ({ stage }) => {
        const features = featureFlagStore.getFeaturesByStage(stage);

        expect(features).toBeDefined();
        expect(features.length).toBeGreaterThan(0);
        features.forEach(feature => {
          expect(feature.metadata.stage).toBe(stage);
        });
      });
    });

    describe("getAvailableFeatures", () => {
      it("should return only available features", () => {
        const availableFeatures = featureFlagStore.getAvailableFeatures();
        expect(availableFeatures.length).toBeGreaterThan(0);
        availableFeatures.forEach(f => {
          expect(featureFlagStore.isFeatureAvailable(f.key)).toBe(true);
        });
      });
    });

    describe("getFeatureMetadata", () => {
      it.each([
        {
          scenario: "valid feature key",
          key: FeatureFlags.DEBUG_MODE.key,
          expectedResult: expect.objectContaining({
            name: "Debug Mode",
            since: "1.0.0",
          }),
          shouldBeNull: false,
        },
        {
          scenario: "invalid feature key",
          key: "non_existent_feature",
          expectedResult: null,
          shouldBeNull: true,
        },
      ])("should handle $scenario", ({ key, expectedResult, shouldBeNull }) => {
        const metadata = featureFlagStore.getFeatureMetadata(key);

        if (shouldBeNull) {
          expect(metadata).toBeNull();
        } else {
          expect(metadata).toEqual(expectedResult);
        }
      });
    });

    describe("generateFeaturesDoc", () => {
      it("should generate complete feature documentation", () => {
        const docs = featureFlagStore.generateFeaturesDoc();

        expect(docs).toBeDefined();
        expect(docs.currentVersion).toBe("1.5.0");
        expect(Object.keys(docs.features).length).toBeGreaterThan(0);

        // Verify structure of a feature entry
        const debugFeature = docs.features[FeatureFlags.DEBUG_MODE.key];
        expect(debugFeature).toBeDefined();
        expect(debugFeature.name).toBeDefined();
        expect(debugFeature.description).toBeDefined();
        expect(debugFeature.stage).toBeDefined();
        expect(debugFeature.since).toBeDefined();
        expect("until" in debugFeature).toBe(true); // Could be null
        expect(debugFeature.isAvailable).toBeDefined();
      });
    });
  });
});
