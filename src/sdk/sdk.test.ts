// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test } from "@jest/globals";
import { PeprValidateRequest } from "../lib/validate-request";
import { PeprMutateRequest } from "../lib/mutate-request";
import { a } from "../lib";
import { containers, writeEvent, getOwnerRefFrom, sanitizeResourceName } from "./sdk";
import * as fc from "fast-check";
import { beforeEach, describe, it, jest } from "@jest/globals";
import { GenericKind } from "kubernetes-fluent-client";
import { K8s, kind } from "kubernetes-fluent-client";
import { Mock } from "jest-mock";
import { V1OwnerReference } from "@kubernetes/client-node";

jest.mock("kubernetes-fluent-client", () => ({
  K8s: jest.fn(),
  Log: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  kind: {
    CoreEvent: "CoreEvent",
  },
}));

describe("containers", () => {
  test("should return a list of containers in the pod when in a validate block", async () => {
    const standardContainers = [
      {
        name: "container-1",
      },
    ];
    const initContainers = [
      {
        name: "init-container-1",
      },
    ];
    const ephemeralContainers = [
      {
        name: "ephemeral-container-1",
      },
    ];
    const allContainers = [...standardContainers, ...initContainers, ...ephemeralContainers];
    const peprValidationRequest = {
      Raw: {
        spec: {
          containers: standardContainers,
          initContainers,
          ephemeralContainers,
        },
      },
    } as PeprValidateRequest<a.Pod>;

    let result = containers(peprValidationRequest);
    expect(result).toEqual(expect.arrayContaining(allContainers));
    expect(result).toHaveLength(allContainers.length);

    result = containers(peprValidationRequest, "containers");
    expect(result).toEqual(expect.arrayContaining(standardContainers));
    expect(result).toHaveLength(standardContainers.length);

    result = containers(peprValidationRequest, "initContainers");
    expect(result).toEqual(expect.arrayContaining(initContainers));
    expect(result).toHaveLength(initContainers.length);

    result = containers(peprValidationRequest, "ephemeralContainers");
    expect(result).toEqual(expect.arrayContaining(ephemeralContainers));
    expect(result).toHaveLength(ephemeralContainers.length);
  });

  test("should return a list of containers in the pod when in a mutate block", async () => {
    const standardContainers = [
      {
        name: "container-1",
      },
    ];
    const initContainers = [
      {
        name: "init-container-1",
      },
    ];
    const ephemeralContainers = [
      {
        name: "ephemeral-container-1",
      },
    ];
    const allContainers = [...standardContainers, ...initContainers, ...ephemeralContainers];
    const peprMutateRequest = {
      Raw: {
        spec: {
          containers: standardContainers,
          initContainers,
          ephemeralContainers,
        },
      },
    } as PeprMutateRequest<a.Pod>;

    let result = containers(peprMutateRequest);
    expect(result).toEqual(expect.arrayContaining(allContainers));
    expect(result).toHaveLength(allContainers.length);

    result = containers(peprMutateRequest, "containers");
    expect(result).toEqual(expect.arrayContaining(standardContainers));
    expect(result).toHaveLength(standardContainers.length);

    result = containers(peprMutateRequest, "initContainers");
    expect(result).toEqual(expect.arrayContaining(initContainers));
    expect(result).toHaveLength(initContainers.length);

    result = containers(peprMutateRequest, "ephemeralContainers");
    expect(result).toEqual(expect.arrayContaining(ephemeralContainers));
    expect(result).toHaveLength(ephemeralContainers.length);
  });
});

describe("writeEvent", () => {
  let Create: Mock;
  beforeEach(() => {
    jest.clearAllMocks();

    Create = jest.fn();

    (K8s as jest.Mock).mockImplementation(() => ({
      Create,
      PatchStatus: jest.fn(),
    }));
  });

  it("should write a K8s event for the CRD", async () => {
    const cr = {
      apiVersion: "v1",
      kind: "Package",
      metadata: { name: "test", namespace: "default", uid: "1" },
    };
    const event = { message: "Test event" };
    await writeEvent(
      cr as GenericKind,
      event,
      "Warning",
      "ReconciliationFailed",
      "uds.dev/operator",
      process.env.HOSTNAME as string,
    );
    expect(K8s).toHaveBeenCalledWith(kind.CoreEvent);
    expect(Create).toHaveBeenCalledWith({
      ...event,
      type: "Warning",
      reason: "ReconciliationFailed",
      metadata: { namespace: "default", generateName: "test" },
      involvedObject: {
        apiVersion: "v1",
        kind: "Package",
        name: "test",
        namespace: "default",
        uid: "1",
      },
      firstTimestamp: expect.any(Date),
      reportingComponent: "uds.dev/operator",
      reportingInstance: process.env.HOSTNAME,
    });
  });
});

describe("getOwnerRefFrom", () => {
  it("should return the owner reference for the CRD", () => {
    const cr = {
      apiVersion: "v1",
      kind: "Package",
      metadata: { name: "test", namespace: "default", uid: "1" },
    };
    const ownerRef = getOwnerRefFrom(cr as GenericKind);
    expect(ownerRef).toEqual([
      {
        apiVersion: "v1",
        kind: "Package",
        name: "test",
        uid: "1",
      },
    ]);
  });

  const crWithoutOptionals = {
    apiVersion: "v1",
    kind: "Package",
    metadata: { name: "test", namespace: "default", uid: "1" },
  };

  const crWithController = { ...crWithoutOptionals, controller: true };
  const crWithBlockOwnerDeletion = { ...crWithoutOptionals, blockOwnerDeletion: false };
  const crWithAllFields = { ...crWithoutOptionals, controller: true, blockOwnerDeletion: true };

  const ownerRefWithoutOptionals = [
    {
      apiVersion: "v1",
      kind: "Package",
      name: "test",
      uid: "1",
    },
  ];

  const ownerRefWithController = ownerRefWithoutOptionals.map(item => ({
    ...item,
    controller: true,
  }));
  const ownerRefWithBlockOwnerDeletion = ownerRefWithoutOptionals.map(item => ({
    ...item,
    blockOwnerDeletion: false,
  }));
  const ownerRefWithAllFields = ownerRefWithoutOptionals.map(item => ({
    ...item,
    controller: true,
    blockOwnerDeletion: true,
  }));

  const V1OwnerReferenceFieldCount = Object.getOwnPropertyNames(V1OwnerReference).length;

  test.each([
    [crWithAllFields, ownerRefWithAllFields, V1OwnerReferenceFieldCount],
    [crWithBlockOwnerDeletion, ownerRefWithBlockOwnerDeletion, V1OwnerReferenceFieldCount - 1],
    [crWithController, ownerRefWithController, V1OwnerReferenceFieldCount - 1],
    [crWithoutOptionals, ownerRefWithoutOptionals, V1OwnerReferenceFieldCount - 2],
  ])(
    "should return the owner reference for the CRD with any combination of V1OwnerReference fields",
    (customResource, ownerReference, fieldCount) => {
      const result = getOwnerRefFrom(customResource);
      expect(result).toEqual(ownerReference);
      expect(Object.keys(result[0]).length).toEqual(fieldCount);
    },
  );
});

describe("sanitizeResourceName Fuzzing Tests", () => {
  test("should handle any random string input", () => {
    fc.assert(
      fc.property(fc.string(), name => {
        expect(() => sanitizeResourceName(name)).not.toThrow();
        const sanitized = sanitizeResourceName(name);
        expect(typeof sanitized).toBe("string");
      }),
    );
  });
});

describe("sanitizeResourceName Property-Based Tests", () => {
  test("should always return lowercase, alphanumeric names without leading/trailing hyphens", () => {
    fc.assert(
      fc.property(fc.string(), name => {
        const sanitized = sanitizeResourceName(name);
        if (sanitized.length > 0) {
          expect(sanitized).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        }
        expect(sanitized).toBe(sanitized.toLowerCase());
        expect(sanitized.length).toBeLessThanOrEqual(250);
      }),
    );
  });
});

describe("sanitizeResourceName", () => {
  it("should return same resource name if no sanitization needed", () => {
    const resourceName = "test-resource";
    const sanitizedResourceName = sanitizeResourceName(resourceName);
    expect(sanitizedResourceName).toEqual("test-resource");
  });

  it("should replace capital letters with lowercase letters", () => {
    const resourceName = "Test-ResourCe";
    const sanitizedResourceName = sanitizeResourceName(resourceName);
    expect(sanitizedResourceName).toEqual("test-resource");
  });

  it("should replace sequences of non-alphanumeric characters with a single -", () => {
    const resourceName = "test-*^%- -!=!resource";
    const sanitizedResourceName = sanitizeResourceName(resourceName);
    expect(sanitizedResourceName).toEqual("test-resource");
  });

  it("should truncate name to 250 characters", () => {
    const resourceName =
      "test-resourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresource";
    const sanitizedResourceName = sanitizeResourceName(resourceName);
    expect(sanitizedResourceName).toEqual(
      "test-resourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresourceresou",
    );
  });

  it("should remove leading and trailing non-letter characters", () => {
    const resourceName = " 1=-test-resource *2 ";
    const sanitizedResourceName = sanitizeResourceName(resourceName);
    expect(sanitizedResourceName).toEqual("test-resource");
  });
});
