import { describe, expect, it, jest } from "@jest/globals";
import { fillCache, flushCache } from "./migrateCache";
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

  it("should reject unsupported operations", () => {
    expect(() => {
      fillCache({}, "capability", "unsupported" as "remove", { key: ["key"] }); // Type coercion for "unsupported" to verify exception occurs
    }).toThrow("Unsupported operation: unsupported");
  });

  describe("when updates are sent to the PeprStore", () => {
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

  describe("when creating 'add' operations", () => {
    it("should write to the cache", () => {
      const expected: Record<string, Operation> = {
        "add:/data/capability-v2-key:value": { op: "add", path: "/data/capability-v2-key", value: "value" },
      };
      const result = fillCache({}, "capability", "add", { key: ["key"], value: "value" });
      expect(result).toStrictEqual(expected);
    });

    it("should write undefined values as empty-string", () => {
      const input: Record<string, Operation> = {
        "add:/data/capability-v2-key:": { op: "add", path: "/data/capability-v2-key", value: "" },
      };
      const result = fillCache({}, "capability", "add", { key: ["key"] });
      expect(result).toStrictEqual(input);
    });

    describe("when creating 'remove' operations", () => {
      it("should write to the cache", () => {
        const input: Record<string, Operation> = {
          "remove:/data/capability-key": { op: "remove", path: "/data/capability-key" },
        };
        const result = fillCache({}, "capability", "remove", { key: ["key"] });
        expect(result).toStrictEqual(input);
      });

      it("should require a key to be defined", () => {
        // eslint-disable-next-line max-nested-callbacks
        expect(() => {
          fillCache({}, "capability", "remove", { key: [] });
        }).toThrow("Key is required for REMOVE operation");
      });
    });
  });
});
