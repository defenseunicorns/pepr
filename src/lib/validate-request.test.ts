// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it } from "@jest/globals";
import { KubernetesObject } from "kubernetes-fluent-client";
import { Operation } from "./enums";
import { PeprValidateRequest } from "./validate-request";
import { AdmissionRequest, ValidateActionResponse } from "./common-types";
describe("PeprValidateRequest", () => {
  let mockRequest: AdmissionRequest<KubernetesObject>;

  beforeEach(() => {
    mockRequest = {
      operation: Operation.CREATE,
      uid: "test-uid",
      kind: {
        group: "",
        version: "v1",
        kind: "Pod",
      },
      resource: {
        group: "",
        version: "v1",
        resource: "pods",
      },
      name: "test-pod",
      userInfo: {
        username: "test-user",
        groups: ["test-group"],
      },
      object: {
        apiVersion: "v1",
        kind: "Pod",
        metadata: {
          name: "test-pod",
          labels: {
            "test-label": "true",
          },
          annotations: {
            "test-annotation": "true",
          },
        },
      },
    };
  });

  it("should initialize correctly for non-DELETE operations", () => {
    const wrapper = new PeprValidateRequest(mockRequest);
    expect(wrapper.Raw).toEqual(mockRequest.object);
  });

  it("should initialize correctly for DELETE operations", () => {
    mockRequest = {
      ...mockRequest,
      operation: Operation.DELETE,
      oldObject: {
        apiVersion: "v1",
        kind: "Pod",
        metadata: {
          name: "test-pod",
        },
      },
    };

    const wrapper = new PeprValidateRequest(mockRequest);
    expect(wrapper.Raw).toEqual(mockRequest.oldObject);
  });

  it("should provide access to old resource", () => {
    mockRequest = {
      ...mockRequest,
      oldObject: {
        apiVersion: "v1",
        kind: "Pod",
        metadata: {
          name: "old-test-pod",
        },
      },
    };
    const wrapper = new PeprValidateRequest(mockRequest);
    expect(wrapper.OldResource).toEqual(mockRequest.oldObject);
  });

  it("should provide access to the request object", () => {
    const wrapper = new PeprValidateRequest(mockRequest);
    expect(wrapper.Request).toEqual(mockRequest);
  });

  it("should check if a label exists", () => {
    const wrapper = new PeprValidateRequest(mockRequest);
    expect(wrapper.HasLabel("test-label")).toBeTruthy();
    expect(wrapper.HasLabel("non-existent-label")).toBeFalsy();
  });

  it("should check if an annotation exists", () => {
    const wrapper = new PeprValidateRequest(mockRequest);
    expect(wrapper.HasAnnotation("test-annotation")).toBeTruthy();
    expect(wrapper.HasAnnotation("non-existent-annotation")).toBeFalsy();
  });

  it("should create an approval response", () => {
    const wrapper = new PeprValidateRequest(mockRequest);
    const response: ValidateActionResponse = wrapper.Approve();
    expect(response).toEqual({ allowed: true });
  });

  it("should create a denial response", () => {
    const wrapper = new PeprValidateRequest(mockRequest);
    const response: ValidateActionResponse = wrapper.Deny("Not allowed", 403);
    expect(response).toEqual({ allowed: false, statusMessage: "Not allowed", statusCode: 403 });
  });

  it("should throw an error if the request object is not available", () => {
    mockRequest = {
      ...mockRequest,
      object: undefined as unknown as KubernetesObject,
    };
    expect(() => new PeprValidateRequest(mockRequest)).toThrowError(
      "unable to load the request object into PeprRequest.Raw",
    );
  });
});
