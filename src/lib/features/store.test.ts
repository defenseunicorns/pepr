// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { featureStore, FeatureStore } from "./store";
import { describe, beforeEach, it, expect } from "vitest";

describe("FeatureStore", () => {
  beforeEach(() => {
    // Reset the feature store before each test
    featureStore.reset();
  });

  describe("when parsing strings for features", () => {
    it.each([
      {
        type: "boolean",
        input: "feature1=true,feature2=false",
        expected: {
          feature1: true,
          feature2: false,
        },
      },
      {
        type: "numeric",
        input: "level=5,count=10.5",
        expected: {
          level: 5,
          count: 10.5,
        },
      },
      {
        type: "string",
        input: "name=value,mode=advanced",
        expected: {
          name: "value",
          mode: "advanced",
        },
      },
    ])("should parse $type values", ({ input, expected }) => {
      featureStore.parseFromString(input);

      Object.entries(expected).forEach(([key, value]) => {
        expect(featureStore.get(key)).toBe(value);
      });
    });

    it("should handle malformed entries", () => {
      const input = "valid=true,novalue=,=noproperty,invalid";
      const expected = { valid: true };
      const invalidKeys = ["novalue", "noproperty"];

      featureStore.parseFromString(input);

      Object.entries(expected).forEach(([key, value]) => {
        expect(featureStore.get(key)).toBe(value);
      });

      invalidKeys.forEach(key => {
        expect(featureStore.hasFeature(key)).toBe(false);
      });
    });

    it("should handle empty strings", () => {
      featureStore.parseFromString("");
      expect(featureStore.getAll()).toEqual({});
    });
  });

  describe("when accessing features", () => {
    beforeEach(() => {
      featureStore.parseFromString("string=value,number=42,boolean=true");
    });

    describe("with .get()", () => {
      describe("with existing features", () => {
        it.each([
          { type: "string", key: "string", expected: "value" },
          { type: "number", key: "number", expected: 42 },
          { type: "boolean", key: "boolean", expected: true },
        ])("should return $type values", ({ key, expected }) => {
          expect(featureStore.get<typeof expected>(key)).toBe(expected);
        });
      });

      describe("with non-existent features", () => {
        it.each([
          { type: "string", defaultValue: "default", expected: "default" },
          { type: "number", defaultValue: 100, expected: 100 },
          { type: "boolean", defaultValue: false, expected: false },
        ])("should return default $type value", ({ defaultValue, expected }) => {
          expect(featureStore.get("nonexistent", defaultValue)).toBe(expected);
        });

        it("should return undefined without default", () => {
          expect(featureStore.get("nonexistent")).toBeUndefined();
        });
      });
    });

    describe("with .hasFeature()", () => {
      it("should return true for existing features", () => {
        expect(featureStore.hasFeature("string")).toBe(true);
      });

      it("should return false for non-existent features", () => {
        expect(featureStore.hasFeature("nonexistent")).toBe(false);
      });
    });

    it("should return all features", () => {
      const features = featureStore.getAll();
      expect(features).toEqual({
        string: "value",
        number: 42,
        boolean: true,
      });

      // Verify it's a copy by modifying the returned object
      features.string = "modified";
      expect(featureStore.get("string")).toBe("value"); // Original remains unchanged
    });
  });

  describe("when features are set with environment variables", () => {
    it("should load features", () => {
      // Save original process.env
      const originalEnv = { ...process.env };

      try {
        // Set test environment variables
        process.env.PEPR_FEATURE_TEST1 = "true";
        process.env.PEPR_FEATURE_TEST2 = "42";
        process.env.PEPR_FEATURE_TEST3 = "value";

        // Initialize from environment
        featureStore.initFromEnv();

        // Check features were loaded correctly
        expect(featureStore.get("test1")).toBe(true);
        expect(featureStore.get("test2")).toBe(42);
        expect(featureStore.get("test3")).toBe("value");
      } finally {
        // Restore original process.env
        process.env = originalEnv;
      }
    });
  });

  describe("when feature count validation limits complexity", () => {
    beforeEach(() => {
      // Reset the feature store before each test
      featureStore.reset();
    });

    it("should allow up to 4 feature flags", () => {
      // Should not throw when adding 4 features
      expect(() => {
        featureStore.parseFromString("feature1=true,feature2=false,feature3=42,feature4=test");
      }).not.toThrow();

      // Verify all 4 features were added
      expect(Object.keys(featureStore.getAll()).length).toBe(4);
    });

    it("should not allow more than 4 feature flags", () => {
      // First add 4 features that should not exceed the limit
      featureStore.reset();
      expect(() => {
        featureStore.parseFromString("feature1=true,feature2=false,feature3=42,feature4=test");
      }).not.toThrow();

      // Now attempt to add a 5th feature, which should throw
      expect(() => {
        featureStore.parseFromString("feature5=extra");
      }).toThrow("Too many feature flags active: 5 (maximum: 4)");
    });

    it("should validate feature count during direct method calls", () => {
      // Should pass validation with exactly 4 features
      expect(() => {
        featureStore.parseFromString("feature1=true,feature2=false,feature3=42,feature4=test");
        featureStore.validateFeatureCount();
      }).not.toThrow();

      // Reset and create a scenario with too many features
      // We need to bypass the parseFromString validation to test the direct validateFeatureCount call
      featureStore.reset();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = FeatureStore.getInstance() as any; // Use 'any' to access private features
      store.features = {
        feature1: true,
        feature2: false,
        feature3: 42,
        feature4: "test",
        feature5: "extra",
      };

      // Now validate that calling validateFeatureCount directly throws the expected error
      expect(() => featureStore.validateFeatureCount()).toThrow(
        "Too many feature flags active: 5 (maximum: 4)",
      );
    });
  });
});
