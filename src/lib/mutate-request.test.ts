// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it } from "@jest/globals";
import { KubernetesObject } from "kubernetes-fluent-client";
import { Operation } from "./enums";
import { PeprMutateRequest } from "./mutate-request";
import { AdmissionRequest } from "./common-types";

describe("PeprMutateRequest", () => {
  let mockRequest: AdmissionRequest<KubernetesObject>;

  beforeEach(() => {
    mockRequest = {
      operation: Operation.CREATE,
      object: {
        apiVersion: "v1",
        kind: "Pod",
        metadata: {
          name: "test-pod",
          labels: {
            "existing-label": "true",
          },
          annotations: {
            "existing-annotation": "true",
          },
        },
      },
      dryRun: false,
      uid: "test-uid",
      name: "test-pod",
      kind: { group: "", version: "v1", kind: "Pod" },
      resource: { group: "", version: "v1", resource: "pods" },
      userInfo: {},
    };
  });

  it("should initialize correctly for non-DELETE operations", () => {
    const wrapper = new PeprMutateRequest(mockRequest);
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

    const wrapper = new PeprMutateRequest(mockRequest);
    expect(wrapper.Raw).toEqual(mockRequest.oldObject);
  });

  it("should provide correct value for PermitSideEffects", () => {
    const wrapper = new PeprMutateRequest(mockRequest);
    expect(wrapper.PermitSideEffects).toEqual(true);
  });

  it("should provide correct value for IsDryRun", () => {
    const wrapper = new PeprMutateRequest(mockRequest);
    expect(wrapper.IsDryRun).toEqual(false);
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
    const wrapper = new PeprMutateRequest(mockRequest);
    expect(wrapper.OldResource).toEqual(mockRequest.oldObject);
  });

  it("should provide access to the request object", () => {
    const wrapper = new PeprMutateRequest(mockRequest);
    expect(wrapper.Request).toEqual(mockRequest);
  });

  it("should throw an error if the request object is not available", () => {
    mockRequest = {
      ...mockRequest,
      object: undefined as unknown as KubernetesObject,
    };

    expect(() => new PeprMutateRequest(mockRequest)).toThrow(
      "Unable to load the request object into PeprRequest.Raw",
    );
  });

  it("should merge the provided object with the current resource", () => {
    const wrapper = new PeprMutateRequest(mockRequest);
    wrapper.Merge({
      metadata: {
        labels: {
          "test-label-2": "true",
        },
      },
    });

    expect(wrapper.Raw.metadata?.labels).toEqual({
      "existing-label": "true",
      "test-label-2": "true",
    });
  });

  it("should set a label", () => {
    const wrapper = new PeprMutateRequest(mockRequest);
    wrapper.SetLabel("new-label", "newValue");
    expect(wrapper.Raw.metadata?.labels?.["new-label"]).toEqual("newValue");
  });

  it("should set an annotation", () => {
    const wrapper = new PeprMutateRequest(mockRequest);
    wrapper.SetAnnotation("new-annotation", "newValue");
    expect(wrapper.Raw.metadata?.annotations?.["new-annotation"]).toEqual("newValue");
  });

  it("should remove an existing label", () => {
    const wrapper = new PeprMutateRequest(mockRequest);
    wrapper.RemoveLabel("existing-label");
    expect(wrapper.Raw.metadata?.labels?.["existing-label"]).toBeUndefined();
  });

  it("should remove an existing annotation", () => {
    const wrapper = new PeprMutateRequest(mockRequest);
    wrapper.RemoveAnnotation("existing-annotation");
    expect(wrapper.Raw.metadata?.annotations?.["existing-annotation"]).toBeUndefined();
  });

  it("should check if a label exists", () => {
    const wrapper = new PeprMutateRequest(mockRequest);
    expect(wrapper.HasLabel("existing-label")).toBeTruthy();
    expect(wrapper.HasLabel("non-existent-label")).toBeFalsy();
  });

  it("should check if an annotation exists", () => {
    const wrapper = new PeprMutateRequest(mockRequest);
    expect(wrapper.HasAnnotation("existing-annotation")).toBeTruthy();
    expect(wrapper.HasAnnotation("non-existent-annotation")).toBeFalsy();
  });

  it("should set a label when metadata and labels do not exist", () => {
    delete mockRequest.object.metadata;
    const wrapper = new PeprMutateRequest(mockRequest);
    wrapper.SetLabel("new-label", "newValue");
    expect(wrapper.Raw.metadata?.labels?.["new-label"]).toEqual("newValue");
  });

  it("should set an annotation when metadata and annotations do not exist", () => {
    delete mockRequest.object.metadata;
    const wrapper = new PeprMutateRequest(mockRequest);
    wrapper.SetAnnotation("new-annotation", "newValue");
    expect(wrapper.Raw.metadata?.annotations?.["new-annotation"]).toEqual("newValue");
  });

  it("should not throw an error when removing a non-existent label", () => {
    delete mockRequest.object.metadata;
    const wrapper = new PeprMutateRequest(mockRequest);
    expect(() => wrapper.RemoveLabel("non-existent-label")).not.toThrow();
  });

  it("should not throw an error when removing a non-existent annotation", () => {
    delete mockRequest.object.metadata;
    const wrapper = new PeprMutateRequest(mockRequest);
    expect(() => wrapper.RemoveAnnotation("non-existent-annotation")).not.toThrow();
  });

  it("should return false for HasLabel when metadata or labels do not exist", () => {
    delete mockRequest.object.metadata;
    const wrapper = new PeprMutateRequest(mockRequest);
    expect(wrapper.HasLabel("any-label")).toBeFalsy();
  });

  it("should return false for HasAnnotation when metadata or annotations do not exist", () => {
    delete mockRequest.object.metadata;
    const wrapper = new PeprMutateRequest(mockRequest);
    expect(wrapper.HasAnnotation("any-annotation")).toBeFalsy();
  });
});
