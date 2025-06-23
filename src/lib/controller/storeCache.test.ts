import { describe, expect, it, vi, beforeEach } from "vitest";
import { fillStoreCache, sendUpdatesAndFlushCache, updateCacheID } from "./storeCache";
import { Operation } from "fast-json-patch";
import { GenericClass, K8s, KubernetesObject } from "kubernetes-fluent-client";
import { K8sInit } from "kubernetes-fluent-client/dist/fluent/types";

vi.mock("kubernetes-fluent-client");

vi.mock("../telemetry/logger", () => ({
  __esModule: true,
  default: {
    error: vi.fn(),
  },
}));

describe("StoreCache", () => {
  const mockK8s = vi.mocked(K8s);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("fillStoreCache", () => {
    describe("when given an unsupported operation", () => {
      it("should throw an error with the operation name", () => {
        expect(() => {
          fillStoreCache({}, "capability", "unsupported" as "remove", { key: ["key"] }); // Type coercion to verify exception occurs
        }).toThrow("Unsupported operation: unsupported");
      });
    });

    describe("add operations", () => {
      describe("when creating an add operation with a value", () => {
        it("should add the entry to the cache with the provided value", () => {
          const emptyCache = {};
          const capability = "capability";
          const operation = "add";
          const params = {
            key: ["key"],
            value: "value",
            version: "",
          };

          const result = fillStoreCache(emptyCache, capability, operation, params);

          const expected: Record<string, Operation> = {
            "add:/data/capability-key:value": {
              op: "add",
              path: "/data/capability-key",
              value: "value",
            },
          };
          expect(result).toStrictEqual(expected);
        });
      });

      describe("when creating an add operation with undefined value", () => {
        it("should add the entry to the cache with an empty string value", () => {
          // Given an empty cache and operation parameters without a value
          const emptyCache = {};
          const params = { key: ["key"], version: "" };

          // When fillStoreCache is called
          const result = fillStoreCache(emptyCache, "capability", "add", params);

          // Then the cache should contain an entry with empty string value
          const expected: Record<string, Operation> = {
            "add:/data/capability-key:": {
              op: "add",
              path: "/data/capability-key",
              value: "",
            },
          };
          expect(result).toStrictEqual(expected);
        });
      });
    });

    describe("remove operations", () => {
      describe("when creating a remove operation with a valid key", () => {
        it("should add the removal entry to the cache", () => {
          // Given an empty cache and valid remove parameters
          const emptyCache = {};
          const params = { key: ["key"] };

          // When fillStoreCache is called with remove operation
          const result = fillStoreCache(emptyCache, "capability", "remove", params);

          // Then the cache should contain a removal operation
          const expected: Record<string, Operation> = {
            "remove:/data/capability-key": {
              op: "remove",
              path: "/data/capability-key",
            },
          };
          expect(result).toStrictEqual(expected);
        });
      });

      describe("when creating a remove operation with an empty key", () => {
        it("should throw an error about requiring a key", () => {
          // Given an empty cache and invalid remove parameters (empty key)
          const emptyCache = {};
          const params = { key: [] };

          // When fillStoreCache is called with remove operation and empty key
          // Then it should throw an error
          expect(() => {
            fillStoreCache(emptyCache, "capability", "remove", params);
          }).toThrow("Key is required for REMOVE operation");
        });
      });
    });
  });

  describe("sendUpdatesAndFlushCache", () => {
    describe("when the update is successful", () => {
      it("should send updates and clear the cache", async () => {
        // Given a mocked successful Kubernetes patch operation
        mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
          return {
            Patch: vi.fn().mockResolvedValueOnce(undefined as never),
          } as unknown as K8sInit<T, K>;
        });

        // And a cache with operations
        const cache: Record<string, Operation> = {
          entry: { op: "remove", path: "/some/path" },
          entry2: { op: "add", path: "some/path", value: "value" },
        };

        // When sendUpdatesAndFlushCache is called
        const result = await sendUpdatesAndFlushCache(cache, "some namespace", "some name");

        // Then the cache should be cleared
        expect(result).toStrictEqual({});
      });
    });

    describe("when the update fails with a 422 Unprocessable Entity error", () => {
      it("should clear the cache despite the error", async () => {
        mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
          return {
            Patch: vi.fn().mockRejectedValueOnce({ status: 422 } as never),
          } as unknown as K8sInit<T, K>;
        });

        // And a cache with operations
        const cache: Record<string, Operation> = {
          entry: { op: "remove", path: "/some/path" },
          entry2: { op: "add", path: "some/path", value: "value" },
        };

        // When sendUpdatesAndFlushCache is called
        const result = await sendUpdatesAndFlushCache(cache, "some namespace", "some name");

        // Then the cache should still be cleared
        expect(result).toStrictEqual({});
      });
    });

    describe("when the update fails with an error other than 422", () => {
      it("should repopulate the cache with the original operations", async () => {
        mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
          return {
            Patch: vi.fn().mockRejectedValueOnce({ status: 400 } as never),
          } as unknown as K8sInit<T, K>;
        });

        const cache: Record<string, Operation> = {
          entry: { op: "remove", path: "/some/path" },
          entry2: { op: "add", path: "some/path", value: "value" },
        };
        const result = await sendUpdatesAndFlushCache(cache, "some namespace", "some name");
        expect(result).toStrictEqual(cache);
      });
    });
  });

  describe("updateCacheID", () => {
    it("should add a cache ID update to the array of patches", () => {
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
});
