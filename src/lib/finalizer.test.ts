// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it } from "@jest/globals";
import { addFinalizer } from "./finalizer";
import { KubernetesObject } from "kubernetes-fluent-client";
import { Operation, AdmissionRequest } from "./k8s";
import { PeprMutateRequest } from "./mutate-request";

describe("addFinalizer", () => {
  const peprFinal = "pepr.dev/finalizer";
  let request: PeprMutateRequest<KubernetesObject>;

  const fakeAdmissionRequest = (op: Operation): AdmissionRequest<KubernetesObject> => {
    const obj = {
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
    };

    return {
      operation: op,
      object: obj,
      oldObject: obj,
      dryRun: false,
      uid: "uid",
      name: "name",
      kind: { group: "", version: "v1", kind: "Pod" },
      resource: { group: "", version: "v1", resource: "pods" },
      userInfo: {},
    };
  };

  describe("on create", () => {
    const op = Operation.CREATE;

    beforeEach(() => {
      request = new PeprMutateRequest(fakeAdmissionRequest(op));
    });

    it("adds pepr finalizer when no other finalizers are present", () => {
      expect(request.Raw.metadata?.finalizers).toBeUndefined();

      // impure function (acts via side effect instead of return result) --
      //  i.e. it directly modifies the passed-in request object
      addFinalizer(request);

      expect(request.Raw.metadata!.finalizers).toContain(peprFinal);
    });

    it("adds pepr finalizer when other finalizers are present", () => {
      const original = ["i.am.a/macguffin", "i.am.one/too"];
      request.Raw.metadata!.finalizers = [...original];

      addFinalizer(request);

      const expected = [...original, peprFinal];
      expect(request.Raw.metadata!.finalizers).toHaveLength(expected.length);
      expect(request.Raw.metadata!.finalizers).toEqual(expect.arrayContaining(expected));
    });

    it("does not add another pepr finalizer when one is already present", () => {
      const original = ["i.am.a/macguffin", "i.am.one/too", peprFinal];
      request.Raw.metadata!.finalizers = [...original];

      addFinalizer(request);

      const expected = [...original];
      expect(request.Raw.metadata!.finalizers).toHaveLength(expected.length);
      expect(request.Raw.metadata!.finalizers).toEqual(expect.arrayContaining(expected));
    });
  });

  describe("on update", () => {
    const op = Operation.UPDATE;

    beforeEach(() => {
      request = new PeprMutateRequest(fakeAdmissionRequest(op));
    });

    it("adds pepr finalizer when no other finalizers are present", () => {
      expect(request.Raw.metadata?.finalizers).toBeUndefined();

      addFinalizer(request);

      expect(request.Raw.metadata!.finalizers).toContain(peprFinal);
    });

    it("adds pepr finalizer when other finalizers are present", () => {
      const original = ["i.am.a/macguffin", "i.am.one/too"];
      request.Raw.metadata!.finalizers = [...original];

      addFinalizer(request);

      const expected = [...original, peprFinal];
      expect(request.Raw.metadata!.finalizers).toHaveLength(expected.length);
      expect(request.Raw.metadata!.finalizers).toEqual(expect.arrayContaining(expected));
    });

    it("does not add another pepr finalizer when one is already present", () => {
      const original = ["i.am.a/macguffin", "i.am.one/too", peprFinal];
      request.Raw.metadata!.finalizers = [...original];

      addFinalizer(request);

      const expected = [...original];
      expect(request.Raw.metadata!.finalizers).toHaveLength(expected.length);
      expect(request.Raw.metadata!.finalizers).toEqual(expect.arrayContaining(expected));
    });

    it("does not add pepr finalizer if a deletetionTimestamp is present", () => {
      const original = ["i.am.a/macguffin", "i.am.one/too"];
      request.Raw.metadata!.finalizers = [...original];
      request.Raw.metadata!.deletionTimestamp = new Date();

      addFinalizer(request);

      const expected = [...original];
      expect(request.Raw.metadata!.finalizers).toHaveLength(expected.length);
      expect(request.Raw.metadata!.finalizers).toEqual(expect.arrayContaining(expected));
    });
  });

  describe("on delete", () => {
    const op = Operation.DELETE;

    beforeEach(() => {
      request = new PeprMutateRequest(fakeAdmissionRequest(op));
    });

    it("does not add pepr finalizer", () => {
      const original = ["i.am.a/macguffin", "i.am.one/too"];
      request.Raw.metadata!.finalizers = [...original];

      addFinalizer(request);

      const expected = [...original];
      expect(request.Raw.metadata!.finalizers).toHaveLength(expected.length);
      expect(request.Raw.metadata!.finalizers).toEqual(expect.arrayContaining(expected));
    });
  });
});
