// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test } from "@jest/globals";
import { PeprValidateRequest } from "../lib/validate-request";
import { PeprMutateRequest } from "../lib/mutate-request";
import { a } from "../lib";
import { containers, writeEvent, getOwnerRefFrom, sanitizeResourceName } from "./sdk";

import { beforeEach, describe, it, jest } from "@jest/globals";
import { GenericKind } from "kubernetes-fluent-client";
import { K8s, kind } from "kubernetes-fluent-client";
import { Mock } from "jest-mock";

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
