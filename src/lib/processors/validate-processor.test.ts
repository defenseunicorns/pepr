// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { GroupVersionKind, kind, KubernetesObject } from "kubernetes-fluent-client";
import { AdmissionRequest, Binding, Filters } from "../types";
import { Event, Operation } from "../enums";
import { PeprValidateRequest } from "../validate-request";
import { clone } from "ramda";
import * as sut from "./validate-processor";

const testFilters: Filters = {
  annotations: {},
  deletionTimestamp: false,
  labels: {},
  name: "",
  namespaces: [],
  regexName: "^default$",
  regexNamespaces: [] as string[],
};

const testGroupVersionKind: GroupVersionKind = {
  kind: "some-kind",
  group: "some-group",
};

const testBinding: Binding = {
  event: Event.ANY,
  filters: testFilters,
  kind: testGroupVersionKind,
  model: kind.Pod,
  isFinalize: false,
  isMutate: false,
  isQueue: false,
  isValidate: false,
  isWatch: false,
};

export const testAdmissionRequest: AdmissionRequest = {
  uid: "some-uid",
  kind: { kind: "a-kind", group: "a-group" },
  resource: { group: "some-group", version: "some-version", resource: "some-resource" },
  operation: Operation.CONNECT,
  name: "some-name",
  userInfo: {},
  object: {},
};

export const testActionMetadata: Record<string, string> = {};

export const testPeprValidateRequest = (admissionRequest: AdmissionRequest) =>
  new PeprValidateRequest<KubernetesObject>(admissionRequest);

describe("processRequest", () => {
  let binding: Binding;
  let actionMetadata: Record<string, string>;
  let peprValidateRequest: PeprValidateRequest<KubernetesObject>;

  beforeEach(() => {
    binding = clone(testBinding);
    actionMetadata = clone(testActionMetadata);
    peprValidateRequest = testPeprValidateRequest(testAdmissionRequest);
  });

  it("responds on successful validation action", async () => {
    const cbResult = {
      allowed: true,
      statusCode: 200,
      statusMessage: "yay",
    };
    const callback = jest.fn().mockImplementation(() => cbResult) as Binding["validateCallback"];
    binding = { ...clone(testBinding), validateCallback: callback };

    const result = await sut.processRequest(binding, actionMetadata, peprValidateRequest);

    expect(result).toEqual({
      uid: peprValidateRequest.Request.uid,
      allowed: cbResult.allowed,
      status: {
        code: cbResult.statusCode,
        message: cbResult.statusMessage,
      },
    });
  });

  it("responds on unsuccessful validation action", async () => {
    const callback = jest.fn().mockImplementation(() => {
      throw "oof";
    }) as Binding["validateCallback"];
    binding = { ...clone(testBinding), validateCallback: callback };

    const result = await sut.processRequest(binding, actionMetadata, peprValidateRequest);

    expect(result).toEqual({
      uid: peprValidateRequest.Request.uid,
      allowed: false,
      status: {
        code: 500,
        message: `Action failed with error: "oof"`,
      },
    });
  });
});
