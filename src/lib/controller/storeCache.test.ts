import { describe, expect, it, vi, beforeEach } from "vitest";
import { fillStoreCache, sendUpdatesAndFlushCache, updateCacheID } from "./storeCache";
import { Operation } from "fast-json-patch";
import { GenericClass, K8s, KubernetesObject } from "kubernetes-fluent-client";
import { K8sInit } from "kubernetes-fluent-client/dist/fluent/types";
import Log from "../telemetry/logger";

vi.mock("kubernetes-fluent-client");

vi.mock("../telemetry/logger", () => ({
  __esModule: true,
  default: {
    error: vi.fn(),
  },
}));

/**
 * Helper function to set up K8s mock implementation
 * @param mockType - 'success' for resolved promise, 'error' for rejected promise
 * @param errorStatus - HTTP status code for error responses, defaults to 400
 */
function setupK8sMock(mockType: "success" | "error", errorStatus = 400) {
  const mockK8s = vi.mocked(K8s);
  mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
    return {
      Patch:
        mockType === "success"
          ? vi.fn().mockResolvedValueOnce(undefined as never)
          : vi.fn().mockRejectedValueOnce({ status: errorStatus } as never),
    } as unknown as K8sInit<T, K>;
  });
}

describe("StoreCache", () => {
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
    describe("when update succeeds", () => {
      it("should clear the cache", async () => {
        setupK8sMock("success");

        const cache: Record<string, Operation> = {
          entry: { op: "remove", path: "/some/path" },
          entry2: { op: "add", path: "some/path", value: "value" },
        };

        const result = await sendUpdatesAndFlushCache(cache, "some namespace", "some name");

        expect(result).toStrictEqual({});
      });
    });

    describe("when update fails", () => {
      it("should log an error message", async () => {
        setupK8sMock("error", 422);

        await sendUpdatesAndFlushCache(
          {
            entry: { op: "remove", path: "/some/path" },
          },
          "some namespace",
          "some name",
        );

        expect(Log.error).toHaveBeenCalledWith(expect.anything(), "Pepr store update failure");
      });

      it("should clear the cache after an HTTP/422 Error", async () => {
        setupK8sMock("error", 422);

        const cache: Record<string, Operation> = {
          entry: { op: "remove", path: "/some/path" },
          entry2: { op: "add", path: "some/path", value: "value" },
        };

        const result = await sendUpdatesAndFlushCache(cache, "some namespace", "some name");

        expect(result).toStrictEqual({});
      });

      it("should repopulate cache with original operations after non HTTP/422 errors", async () => {
        setupK8sMock("error", 400);

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
