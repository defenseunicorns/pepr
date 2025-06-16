// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, vi } from "vitest";
import { addFinalizer, removeFinalizer } from "./finalizer";
import { KubernetesObject, K8s, GenericClass, RegisterKind } from "kubernetes-fluent-client";
import { K8sInit } from "kubernetes-fluent-client/dist/fluent/types";
import { Operation } from "./enums";
import { PeprMutateRequest } from "./mutate-request";
import { Binding } from "./types";
import { AdmissionRequest } from "./common-types";

vi.mock("kubernetes-fluent-client");
const mockK8s = vi.mocked(K8s);
const mockRegisterKind = vi.mocked(RegisterKind);

jest.mock("./telemetry/logger", () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

const PEPR_FINALIZER = "pepr.dev/finalizer";

describe("addFinalizer", () => {
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

      expect(request.Raw.metadata!.finalizers).toContain(PEPR_FINALIZER);
    });

    it("adds pepr finalizer when other finalizers are present", () => {
      const original = ["i.am.a/macguffin", "i.am.one/too"];
      request.Raw.metadata!.finalizers = [...original];

      addFinalizer(request);

      const expected = [...original, PEPR_FINALIZER];
      expect(request.Raw.metadata!.finalizers).toHaveLength(expected.length);
      expect(request.Raw.metadata!.finalizers).toEqual(expect.arrayContaining(expected));
    });

    it("does not add another pepr finalizer when one is already present", () => {
      const original = ["i.am.a/macguffin", "i.am.one/too", PEPR_FINALIZER];
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

      expect(request.Raw.metadata!.finalizers).toContain(PEPR_FINALIZER);
    });

    it("adds pepr finalizer when other finalizers are present", () => {
      const original = ["i.am.a/macguffin", "i.am.one/too"];
      request.Raw.metadata!.finalizers = [...original];

      addFinalizer(request);

      const expected = [...original, PEPR_FINALIZER];
      expect(request.Raw.metadata!.finalizers).toHaveLength(expected.length);
      expect(request.Raw.metadata!.finalizers).toEqual(expect.arrayContaining(expected));
    });

    it("does not add another pepr finalizer when one is already present", () => {
      const original = ["i.am.a/macguffin", "i.am.one/too", PEPR_FINALIZER];
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

describe("removeFinalizer", () => {
  const mockPatch = vi.fn();

  const fakeBinding = (): Binding =>
    ({
      model: {},
      kind: {},
    }) as unknown as Binding;

  const fakeObject = (): KubernetesObject =>
    ({
      metadata: {
        namespace: "test-namespace",
        name: "test-name",
      },
    }) as KubernetesObject;

  describe("when RegisterKind fails", () => {
    beforeEach(() => {
      vi.resetAllMocks();

      mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
        return { Patch: mockPatch } as unknown as K8sInit<T, K>;
      });

      mockRegisterKind.mockImplementation(() => {
        throw "oops";
      });
    });

    it("does NOT send a JSON Patch to remove pepr finalizers", async () => {
      const object = fakeObject();
      const binding = fakeBinding();

      await removeFinalizer(binding, object);

      expect(mockPatch.mock.calls).toHaveLength(0);
    });
  });

  describe("when RegisterKind succeeds", () => {
    beforeEach(() => {
      vi.resetAllMocks();

      mockPatch.mockImplementation(ops => {
        return { ops };
      });

      mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
        return { Patch: mockPatch } as unknown as K8sInit<T, K>;
      });

      mockRegisterKind.mockImplementation(() => {});
    });

    it("sends a JSON Patch to remove pepr finalizers", async () => {
      const originalFinalizers = ["ignore.me/now", "ignore.me/too", PEPR_FINALIZER];
      const adjustedFinalizers = originalFinalizers.filter(f => f !== PEPR_FINALIZER);

      const object = fakeObject();
      object.metadata!.finalizers = [...originalFinalizers];
      const binding = fakeBinding();

      await removeFinalizer(binding, object);

      const expected = [
        {
          op: "replace",
          path: `/metadata/finalizers`,
          value: adjustedFinalizers,
        },
      ];
      expect(mockPatch.mock.calls).toHaveLength(1);
      expect(mockPatch.mock.calls[0]).toHaveLength(1);
      expect(mockPatch.mock.calls[0][0]).toEqual(expected);
    });
  });
});
