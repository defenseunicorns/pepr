// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import * as fc from "fast-check";
import { redactedPatch, redactedStore } from "./logger";
import { AddOperation } from "fast-json-patch";

describe("Logger", () => {
  beforeEach(() => {
    jest.resetModules(); // Clear the cache for modules
    process.env = {}; // Clear environment variables
  });

  it("should set log level based on LOG_LEVEL environment variable", async () => {
    process.env.LOG_LEVEL = "debug";
    const { default: logger } = await import("./logger");

    expect(logger.level).toBe("debug");
  });

  const redactedValue = "**redacted**";
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

  const addOperationKeys = [
    "add:/data/hello-pepr-a:secret",
    "add:/data/hello-pepr-v2-b:secret",
    "add-/should/not-redact-not-secret",
  ];
  const addOperationValues: AddOperation<string>[] = [
    {
      op: "add",
      path: "add:/data/hello-pepr-a",
      value: "secret",
    },
    {
      op: "add",
      path: "add:/should/redact/",
      value: "secret",
    },
    {
      op: "add",
      path: "add-/should/not/redact",
      value: "not secret",
    },
  ];

  describe("when PEPR_STORE_REDACT_VALUE is true", () => {
    it("should redact keys and values", () => {
      process.env.PEPR_STORE_REDACT_VALUES = "true";
      addOperationKeys.forEach((key, i) => {
        const redactedResult = redactedPatch({ [key]: addOperationValues[i] });
        for (const [key, value] of Object.entries(redactedResult)) {
          if (key.includes(":")) {
            expect(key).toContain(`:${redactedValue}`);
            expect(value).toEqual(expect.objectContaining({ value: redactedValue }));
          } else {
            expect(key).not.toContain(`:${redactedValue}`);
            expect(value).not.toEqual(expect.objectContaining({ value: redactedValue }));
          }
        }
      });
    });

    it("should redact values", () => {
      process.env.PEPR_STORE_REDACT_VALUES = "true";
      fc.assert(
        fc.property(peprStoreFuzz, store => {
          const result = redactedStore(store);

          Object.values(result.data).forEach(value => {
            expect(value).toBe(redactedValue);
          });
        }),
      );
    });
    it("should maintain other store properties", () => {
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
    it("should not redact values", () => {
      process.env.PEPR_STORE_REDACT_VALUES = "false";
      fc.assert(
        fc.property(peprStoreFuzz, store => {
          const result = redactedStore(store);
          expect(result.data).toEqual(store.data);
        }),
      );
    });

    it("should not redact keys and values", () => {
      process.env.PEPR_STORE_REDACT_VALUES = "false";
      addOperationKeys.forEach((key, i) => {
        const redactedResult = redactedPatch({ [key]: addOperationValues[i] });
        for (const [k, v] of Object.entries(redactedResult)) {
          expect(k).not.toContain(`:${redactedValue}`);
          expect(v).not.toEqual(expect.objectContaining({ value: redactedValue }));
        }
      });
    });

    it("should maintain other store properties", () => {
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
});
