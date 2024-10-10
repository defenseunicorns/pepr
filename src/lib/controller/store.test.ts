// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test, describe, it, jest } from "@jest/globals";
import * as fc from "fast-check";
import { redactedStore, redactedPatch, PeprControllerStore } from "./store";
import { AddOperation } from "fast-json-patch";
import { redactedValue } from "./store";
import Log from "../logger";
import { PeprStore } from "../k8s";
import { CapabilityCfg } from "../types";
import { Capability } from "../capability";

describe("pepr store tests", () => {
  const peprStoreFuzz = fc.record({
    kind: fc.constant("PeprStore"),
    apiVersion: fc.constant("v1"),
    metadata: fc.record({
      name: fc.string(),
      namespace: fc.string(),
    }),
    data: fc.dictionary(
      fc.string().filter(str => str !== "__proto__"),
      fc.string().filter(str => str !== "__proto__"),
    ),
  });

  describe("when initializing the store", () => {
    it("should migrate and setup the watch", async () => {
      const capabilityConfig: CapabilityCfg = {
        name: "test-capability",
        description: "Test capability description",
        namespaces: ["default"],
      };

      const testCapability = new Capability(capabilityConfig);

      jest.mock("kubernetes-fluent-client", () => ({
        K8s: jest.fn().mockReturnValue({
          InNamespace: jest.fn().mockReturnThis(),
          Get: jest.fn().mockImplementationOnce(() => new PeprStore()),
        }),
      }));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const peprControllerStore = new PeprControllerStore([testCapability], `pepr-test-schedule`, () => {
        Log.info("✅ Test setup complete");
        // Initialize the schedule store for each capability
        new PeprControllerStore([], `pepr-test-schedule`, () => {
          Log.info("✅ Test scheduling complete");
        });
      });

      // Fast-forward time
      // jest.runAllTimers();

      // Assert the private method was called
      // ??
    });
    it("should create the store resource for a scheduled capability", async () => {
      const capabilityConfig: CapabilityCfg = {
        name: "test-capability",
        description: "Test capability description",
        namespaces: ["default"],
      };

      const testCapability = new Capability(capabilityConfig);

      jest.mock("kubernetes-fluent-client", () => ({
        K8s: jest.fn().mockReturnValue({
          InNamespace: jest.fn().mockReturnThis(),
          Get: jest.fn().mockImplementationOnce(() => new Error()),
        }),
      }));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const peprControllerStore = new PeprControllerStore([testCapability], `pepr-test-store`, () => {
        Log.info("✅ Test setup complete");
        // Initialize the schedule store for each capability
        new PeprControllerStore([], `pepr-test-schedule`, () => {
          Log.info("✅ Test scheduling complete");
        });
      });

      // Fast-forward time
      // jest.runAllTimers();

      // Assert the private method was called
      // ??
    });
  });

  describe("when PEPR_STORE_REDACT_VALUE is true", () => {
    test("should redact keys and values", () => {
      process.env.PEPR_STORE_REDACT_VALUES = "true";
      addOperationKeys.forEach((key, i) => {
        const redactedResult = redactedPatch({ [key]: addOperationValues[i] });
        for (const [k, v] of Object.entries(redactedResult)) {
          expect(k).toContain(`:${redactedValue}`);
          expect(v).toEqual(expect.objectContaining({ value: redactedValue }));
        }
      });
    });

    test("should redact values", () => {
      process.env.PEPR_STORE_REDACT_VALUES = "true";
      fc.assert(
        fc.property(peprStoreFuzz, store => {
          const result = redactedStore(store);

          // eslint-disable-next-line max-nested-callbacks
          Object.values(result.data).forEach(value => {
            expect(value).toBe(redactedValue);
          });
        }),
      );
    });
    test("should maintain other store properties", () => {
      fc.assert(
        fc.property(peprStoreFuzz, store => {
          process.env.PEPR_STORE_REDACT_VALUES = "true";

          const result = redactedStore(store);

          expect(result.kind).toBe(store.kind);
          expect(result.apiVersion).toBe(store.apiVersion);
          expect(result.metadata).toEqual(store.metadata);
        }),
      );
    });
  });

  describe("when PEPR_STORE_REDACT_VALUE is false", () => {
    test("should not redact values", () => {
      process.env.PEPR_STORE_REDACT_VALUES = "false";
      fc.assert(
        fc.property(peprStoreFuzz, store => {
          const result = redactedStore(store);
          expect(result.data).toEqual(store.data);
        }),
      );
    });

    test("should not redact keys and values", () => {
      process.env.PEPR_STORE_REDACT_VALUES = "false";
      addOperationKeys.forEach((key, i) => {
        const redactedResult = redactedPatch({ [key]: addOperationValues[i] });
        for (const [k, v] of Object.entries(redactedResult)) {
          expect(k).not.toContain(`:${redactedValue}`);
          expect(v).not.toEqual(expect.objectContaining({ value: redactedValue }));
        }
      });
    });

    test("should maintain other store properties", () => {
      process.env.PEPR_STORE_REDACT_VALUES = "false";
      fc.assert(
        fc.property(peprStoreFuzz, store => {
          const result = redactedStore(store);

          expect(result.kind).toBe(store.kind);
          expect(result.apiVersion).toBe(store.apiVersion);
          expect(result.metadata).toEqual(store.metadata);
        }),
      );
    });
  });

  const addOperationKeys = [
    "add:/data/hello-pepr-a:secret",
    "add:/data/hello-pepr-v2-b:secret",
    "add:/data/hello-pepr-v2-c:secret",
    "add:/data/hello-pepr-v2-d:secret",
    "add:/data/hello-pepr-v2-e:secret",
    "add:/data/hello-pepr-v2-f:secret",
  ];
  const addOperationValues: AddOperation<string>[] = [
    {
      op: "add",
      path: "add:/data/hello-pepr-a",
      value: "secret",
    },
    {
      op: "add",
      path: "add:/data/hello-pepr-v2-b",
      value: "secret",
    },
    {
      op: "add",
      path: "add:/data/hello-pepr-v2-c",
      value: "secret",
    },
    {
      op: "add",
      path: "add:/data/hello-pepr-v2-d",
      value: "secret",
    },
    {
      op: "add",
      path: "add:/data/hello-pepr-v2-e",
      value: "secret",
    },
    {
      op: "add",
      path: "add:/data/hello-pepr-v2-f",
      value: "secret",
    },
  ];
});
