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
    describe("when given unsupported operations", () => {
      it("should throw error with operation name", () => {
        expect(() => {
          fillStoreCache({}, "capability", "unsupported" as "remove", { key: ["key"] });
        }).toThrow("Unsupported operation: unsupported");
      });
    });

    describe("when using add operations", () => {
      describe("when provided with a value", () => {
        it("should add entry to cache with provided value", () => {
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

      describe("when value is undefined", () => {
        it("should add entry with empty string", () => {
          const emptyCache = {};
          const params = { key: ["key"], version: "" };

          const result = fillStoreCache(emptyCache, "capability", "add", params);

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

    describe("when using remove operations", () => {
      describe("when key is valid", () => {
        it("should add removal entry to cache", () => {
          const emptyCache = {};
          const params = { key: ["key"] };

          const result = fillStoreCache(emptyCache, "capability", "remove", params);

          const expected: Record<string, Operation> = {
            "remove:/data/capability-key": {
              op: "remove",
              path: "/data/capability-key",
            },
          };
          expect(result).toStrictEqual(expected);
        });
      });

      describe("when key is empty", () => {
        it("should throw key required error", () => {
          const emptyCache = {};
          const params = { key: [] };

          expect(() => {
            fillStoreCache(emptyCache, "capability", "remove", params);
          }).toThrow("Key is required for REMOVE operation");
        });
      });
    });
  });

  describe("sendUpdatesAndFlushCache", () => {
    describe("when update is successful", () => {
      it("should clear the cache", async () => {
        mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
          return {
            Patch: vi.fn().mockResolvedValueOnce(undefined as never),
          } as unknown as K8sInit<T, K>;
        });

        const cache: Record<string, Operation> = {
          entry: { op: "remove", path: "/some/path" },
          entry2: { op: "add", path: "some/path", value: "value" },
        };

        const result = await sendUpdatesAndFlushCache(cache, "some namespace", "some name");

        expect(result).toStrictEqual({});
      });
    });

    describe("when update fails with 422 Unprocessable Entity error", () => {
      it("should still clear the cache", async () => {
        mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
          return {
            Patch: vi.fn().mockRejectedValueOnce({ status: 422 } as never),
          } as unknown as K8sInit<T, K>;
        });

        const cache: Record<string, Operation> = {
          entry: { op: "remove", path: "/some/path" },
          entry2: { op: "add", path: "some/path", value: "value" },
        };

        const result = await sendUpdatesAndFlushCache(cache, "some namespace", "some name");

        expect(result).toStrictEqual({});
      });
    });

    describe("when update fails with non-422 error", () => {
      it("should repopulate cache with original operations", async () => {
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
    it("should add cacheID label to patches", () => {
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
