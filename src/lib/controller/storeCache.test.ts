import { describe, expect, it, jest, afterEach } from "@jest/globals";
import { fillStoreCache, sendUpdatesAndFlushCache, updateCacheID } from "./storeCache";
import { Operation } from "fast-json-patch";
import { GenericClass, K8s, KubernetesObject } from "kubernetes-fluent-client";
import { K8sInit } from "kubernetes-fluent-client/dist/fluent/types";

jest.mock("kubernetes-fluent-client");

describe("sendCache", () => {
  const mockK8s = jest.mocked(K8s);

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should reject unsupported operations", () => {
    expect(() => {
      fillStoreCache({}, "capability", "unsupported" as "remove", { key: ["key"] }); // Type coercion for "unsupported" to verify exception occurs
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
      const result = await sendUpdatesAndFlushCache(input, "some namespace", "some name");
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
      const result = await sendUpdatesAndFlushCache(input, "some namespace", "some name");
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
      const result = await sendUpdatesAndFlushCache(input, "some namespace", "some name");
      expect(result).toStrictEqual(input);
    });
  });

  describe("when creating 'add' operations", () => {
    it("should write to the cache", () => {
      const input: Record<string, Operation> = {
        "add:/data/capability-key:value": {
          op: "add",
          path: "/data/capability-key",
          value: "value",
        },
      };
      const result = fillStoreCache({}, "capability", "add", {
        key: ["key"],
        value: "value",
        version: "",
      });
      expect(result).toStrictEqual(input);
    });

    it("should write undefined values as empty-string", () => {
      const input: Record<string, Operation> = {
        "add:/data/capability-key:": { op: "add", path: "/data/capability-key", value: "" },
      };
      const result = fillStoreCache({}, "capability", "add", { key: ["key"], version: "" });
      expect(result).toStrictEqual(input);
    });
  });
  describe("when creating 'remove' operations", () => {
    it("should write to the cache", () => {
      const input: Record<string, Operation> = {
        "remove:/data/capability-key": { op: "remove", path: "/data/capability-key" },
      };
      const result = fillStoreCache({}, "capability", "remove", { key: ["key"] });
      expect(result).toStrictEqual(input);
    });

    it("should require a key to be defined", () => {
      expect(() => {
        fillStoreCache({}, "capability", "remove", { key: [] });
      }).toThrow("Key is required for REMOVE operation");
    });
  });
});

describe("updateCacheId", () => {
  it("should update the metadata label of the cacheID in the payload array of patches", () => {
    const patches: Operation[] = [
      {
        op: "add",
        path: "/data/hello-pepr-v2-a",
        value: "a",
      },
    ];

    const updatedPatches = updateCacheID(patches);
    expect(updatedPatches.length).toBe(2);
    expect(updatedPatches[1].op).toBe("replace");
    expect(updatedPatches[1].path).toBe("/metadata/labels/pepr.dev-cacheID");
  });
});
