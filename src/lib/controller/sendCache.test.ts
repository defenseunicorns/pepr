import { describe, expect, it, jest } from "@jest/globals";
import { fillCache, flushCache } from "./sendCache";
import { Operation } from "fast-json-patch";
import { GenericClass, K8s, KubernetesObject } from "kubernetes-fluent-client";
import { K8sInit } from "kubernetes-fluent-client/dist/fluent/types";
import { afterEach } from "node:test";

jest.mock("kubernetes-fluent-client");

describe("sendCache", () => {
  const mockK8s = jest.mocked(K8s);

  afterEach(() => {
    jest.resetAllMocks();
  });
  describe("when removing entries)", () => {
    it("should clear the cache", async () => {
      mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
        return {
          Patch: jest.fn().mockResolvedValueOnce(undefined as never),
        } as unknown as K8sInit<T, K>;
      });

      const input: Record<string, Operation> = {
        entry: { op: "remove", path: "/some/path" },
        entry2: { op: "add", path: "some/path", value: "value" },
      };
      const result = await flushCache(input, "some namespace", "some name");
      expect(result).toStrictEqual({});
    });

    it("should clear cache for Unprocessable Entity Errors (HTTP/422)", async () => {
      mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
        return {
          Patch: jest.fn().mockRejectedValueOnce({ status: 422 } as never),
        } as unknown as K8sInit<T, K>;
      });

      const input: Record<string, Operation> = {
        entry: { op: "remove", path: "/some/path" },
        entry2: { op: "add", path: "some/path", value: "value" },
      };
      const result = await flushCache(input, "some namespace", "some name");
      expect(result).toStrictEqual({});
    });
    it("should repopulate cache for all other HTTP Errors", async () => {
      mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
        return {
          Patch: jest.fn().mockRejectedValueOnce({ status: 400 } as never),
        } as unknown as K8sInit<T, K>;
      });

      const input: Record<string, Operation> = {
        entry: { op: "remove", path: "/some/path" },
        entry2: { op: "add", path: "some/path", value: "value" },
      };
      const result = await flushCache(input, "some namespace", "some name");
      expect(result).toStrictEqual(input);
    });
  });

  describe("when adding entries)", () => {
    it("should write to the cache", () => {
      const input: Record<string, Operation> = {
        "add:/data/capability-key:value": { op: "add", path: "/data/capability-key", value: "value" },
      };
      const result = fillCache({}, "capability", "add", ["key"], "value");
      expect(result).toStrictEqual(input);
    });

    it("should write undefined values as empty-string", () => {
      const input: Record<string, Operation> = {
        "add:/data/capability-key:": { op: "add", path: "/data/capability-key", value: "" },
      };
      const result = fillCache({}, "capability", "add", ["key"], undefined);
      expect(result).toStrictEqual(input);
    });
  });
});
