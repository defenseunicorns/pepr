// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test, describe, afterEach } from "@jest/globals";
import * as fc from "fast-check";
import { redactedStore, redactedPatch } from "./store";
import { AddOperation } from "fast-json-patch";

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
describe("Fuzzing redactedStore", () => {
  afterEach(() => {
    delete process.env.PEPR_STORE_REDACT_VALUES;
  });

  test("should redact values if PEPR_STORE_REDACT_VALUES is true", () => {
    fc.assert(
      fc.property(peprStoreFuzz, store => {
        process.env.PEPR_STORE_REDACT_VALUES = "true";
        const result = redactedStore(store);

        Object.values(result.data).forEach(value => {
          expect(value).toBe(redactedValue);
        });
      }),
    );
  });

  test("should not redact values if PEPR_STORE_REDACT_VALUES is not true", () => {
    fc.assert(
      fc.property(peprStoreFuzz, store => {
        process.env.PEPR_STORE_REDACTED_VALUES = "false";
        const result = redactedStore(store);
        expect(result.data).toEqual(store.data);
      }),
    );
  });

  test("should maintain other properties of the store", () => {
    fc.assert(
      fc.property(peprStoreFuzz, store => {
        const redactionEnabled = fc.boolean();
        process.env.PEPR_STORE_REDACTED_VALUES = redactionEnabled ? "true" : "false";

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

describe("redactedPatch", () => {
  afterEach(() => {
    delete process.env.PEPR_STORE_REDACTED_VALUES;
  });

  test("should redact keys and values if PEPR_STORE_REDACTED_VALUES is true", () => {
    process.env.PEPR_STORE_REDACTED_VALUES = "true";
    addOperationKeys.forEach((key, i) => {
      const redactedResult = redactedPatch({ [key]: addOperationValues[i] });
      for (const [k, v] of Object.entries(redactedResult)) {
        expect(k).toContain(`:${redactedValue}`);
        expect(v).toEqual(expect.objectContaining({ value: redactedValue }));
      }
    });
  });
  test("should not redact keys and values if PEPR_STORE_REDACTED_VALUES is not true", () => {
    addOperationKeys.forEach((key, i) => {
      const redactedResult = redactedPatch({ [key]: addOperationValues[i] });
      for (const [k, v] of Object.entries(redactedResult)) {
        expect(k).not.toContain(`:${redactedValue}`);
        expect(v).not.toEqual(expect.objectContaining({ value: redactedValue }));
      }
    });
  });
});
