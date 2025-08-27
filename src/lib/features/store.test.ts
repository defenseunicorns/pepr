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
      });

      it("should reject invalid version formats", () => {
        expect(() => featureFlagStore.setVersion("1.0")).toThrow();
        expect(() => featureFlagStore.setVersion("v1.0.0")).toThrow();
        expect(() => featureFlagStore.setVersion("latest")).toThrow();
        expect(() => featureFlagStore.setVersion("1.0.0-alpha")).toThrow();
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

  describe("when checking feature availability based on version", () => {
    beforeEach(() => {
      featureFlagStore.reset();
    });

    describe("since version testing", () => {
      it("should enable features when current version >= since version", () => {
        // Assuming DEBUG_MODE has since="1.0.0"
        featureFlagStore.setVersion("1.0.0");
        expect(featureFlagStore.isFeatureAvailable(FeatureFlags.DEBUG_MODE.key)).toBe(true);

        featureFlagStore.setVersion("1.2.0");
        expect(featureFlagStore.isFeatureAvailable(FeatureFlags.DEBUG_MODE.key)).toBe(true);
      });

      it("should disable features when current version < since version", () => {
        // Assuming EXPERIMENTAL_API has since="1.2.0"
        featureFlagStore.setVersion("1.0.0");
        expect(featureFlagStore.isFeatureAvailable(FeatureFlags.EXPERIMENTAL_API.key)).toBe(false);

        featureFlagStore.setVersion("1.1.9");
        expect(featureFlagStore.isFeatureAvailable(FeatureFlags.EXPERIMENTAL_API.key)).toBe(false);
      });
    });

    describe("until version testing", () => {
      it("should disable features when current version >= until version", () => {
        // Assuming CHARLIE_FEATURES has until="2.0.0"
        featureFlagStore.setVersion("2.0.0");
        expect(featureFlagStore.isFeatureAvailable(FeatureFlags.CHARLIE_FEATURES.key)).toBe(false);

        featureFlagStore.setVersion("2.1.0");
        expect(featureFlagStore.isFeatureAvailable(FeatureFlags.CHARLIE_FEATURES.key)).toBe(false);
      });

      it("should enable features when current version < until version", () => {
        // Assuming CHARLIE_FEATURES has since="1.3.0" and until="2.0.0"
        featureFlagStore.setVersion("1.9.0");
        expect(featureFlagStore.isFeatureAvailable(FeatureFlags.CHARLIE_FEATURES.key)).toBe(true);
      });

      it("should handle null until version", () => {
        // Assuming DEBUG_MODE has until=null
        featureFlagStore.setVersion("999.999.999"); // Very high version
        expect(featureFlagStore.isFeatureAvailable(FeatureFlags.DEBUG_MODE.key)).toBe(true);
      });
    });

    describe("version change impact", () => {
      it("should re-evaluate feature availability when version changes", () => {
        // Setup with feature outside its version range
        featureFlagStore.setVersion("1.0.0");
        featureFlagStore.initialize(`${FeatureFlags.EXPERIMENTAL_API.key}=true`);
        expect(featureFlagStore.isEnabled(FeatureFlags.EXPERIMENTAL_API.key)).toBe(false);

        // Change to version where feature should be available
        featureFlagStore.setVersion("1.3.0");
        // Now the feature should be available and enabled because we set it to true
        expect(featureFlagStore.isEnabled(FeatureFlags.EXPERIMENTAL_API.key)).toBe(true);
      });

      it("should handle features that become unavailable due to version change", () => {
        // Setup with feature in its version range
        featureFlagStore.setVersion("1.5.0");
        featureFlagStore.initialize(`${FeatureFlags.CHARLIE_FEATURES.key}=true`);
        expect(featureFlagStore.isEnabled(FeatureFlags.CHARLIE_FEATURES.key)).toBe(true);

        // Change to version outside range
        featureFlagStore.setVersion("2.0.0");
        // Feature should now be disabled
        expect(featureFlagStore.isEnabled(FeatureFlags.CHARLIE_FEATURES.key)).toBe(false);
      });
    });
  });

  describe("when managing features based on stage", () => {
    beforeEach(() => {
      featureFlagStore.reset();
      featureFlagStore.setVersion("1.5.0"); // Version where all features should be available
    });

    describe("Alpha features", () => {
      it("should be disabled by default", () => {
        // Assuming EXPERIMENTAL_API is an ALPHA feature
        // Don't explicitly enable it
        expect(featureFlagStore.isEnabled(FeatureFlags.EXPERIMENTAL_API.key)).toBe(false);
      });

      it("should be enabled only when explicitly turned on", () => {
        featureFlagStore.initialize(`${FeatureFlags.EXPERIMENTAL_API.key}=true`);
        expect(featureFlagStore.isEnabled(FeatureFlags.EXPERIMENTAL_API.key)).toBe(true);
      });
    });

    describe("Beta features", () => {
      it("should be enabled by default", () => {
        // Assuming PERFORMANCE_METRICS is a BETA feature
        // Don't explicitly set it
        expect(featureFlagStore.isEnabled(FeatureFlags.PERFORMANCE_METRICS.key)).toBe(true);
      });

      it("should respect explicit settings", () => {
        featureFlagStore.initialize(`${FeatureFlags.PERFORMANCE_METRICS.key}=false`);
        expect(featureFlagStore.isEnabled(FeatureFlags.PERFORMANCE_METRICS.key)).toBe(false);
      });
    });

    describe("GA features", () => {
      it("should always be enabled", () => {
        // Assuming DEBUG_MODE is a GA feature
        // Don't explicitly set it
        expect(featureFlagStore.isEnabled(FeatureFlags.DEBUG_MODE.key)).toBe(true);
      });

      it("should respect explicit false settings", () => {
        featureFlagStore.initialize(`${FeatureFlags.DEBUG_MODE.key}=false`);
        expect(featureFlagStore.isEnabled(FeatureFlags.DEBUG_MODE.key)).toBe(false);
      });
    });
  });

  describe("when using feature utility methods", () => {
    beforeEach(() => {
      featureFlagStore.reset();
      featureFlagStore.setVersion("1.5.0"); // Version where all features should be available
    });

    describe("getFeaturesByStage", () => {
      it("should return features for a specific stage", () => {
        const alphaFeatures = featureFlagStore.getFeaturesByStage(FeatureStage.ALPHA);
        const betaFeatures = featureFlagStore.getFeaturesByStage(FeatureStage.BETA);
        const gaFeatures = featureFlagStore.getFeaturesByStage(FeatureStage.GA);

        expect(alphaFeatures).toBeDefined();
        expect(betaFeatures).toBeDefined();
        expect(gaFeatures).toBeDefined();

        // At least one feature in each stage
        expect(alphaFeatures.length).toBeGreaterThan(0);
        expect(betaFeatures.length).toBeGreaterThan(0);
        expect(gaFeatures.length).toBeGreaterThan(0);
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
      it("should retrieve metadata for valid feature keys", () => {
        const metadata = featureFlagStore.getFeatureMetadata(FeatureFlags.DEBUG_MODE.key);
        expect(metadata).toBeDefined();
        expect(metadata?.name).toBe("Debug Mode");
        expect(metadata?.since).toBe("1.0.0");
      });

      it("should return null for invalid feature keys", () => {
        const metadata = featureFlagStore.getFeatureMetadata("non_existent_feature");
        expect(metadata).toBeNull();
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
