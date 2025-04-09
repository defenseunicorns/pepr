import { migrateAndSetupWatch, StoreMigration } from "./migrateStore";
import Log from "../telemetry/logger";
import * as storeCache from "./storeCache";
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { Operation } from "fast-json-patch";
import { Storage } from "../core/storage";

const mockPatch = jest.fn();
jest.mock("../telemetry/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    debug: jest.fn(),
  },
  redactedStore: jest.fn(x => x),
}));

jest.mock("kubernetes-fluent-client", () => {
  return {
    ...(jest.requireActual("kubernetes-fluent-client") as object),
    K8s: jest.fn().mockImplementation(() => ({
      Patch: mockPatch,
    })),
  };
});
jest.mock("./storeCache", () => ({
  ...(jest.requireActual("./storeCache") as object),
  sendUpdatesAndFlushCache: jest.fn(),
}));

describe("migrateAndSetupWatch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should patch the store, transform keys, and call setupWatch", async () => {
    const setupWatch = jest.fn();

    // non-migrated store v1
    const storeMigrationData: StoreMigration = {
      name: "pepr-static-test-store",
      namespace: "pepr-system",
      setupWatch,
      store: {
        kind: "PeprStore",
        data: {
          __pepr_do_not_delete__: "k-thx-bye",
          "hello-pepr-example-1": "was-here",
          "hello-pepr-example-1-data": '{"key":"ex-1-val"}',
          "hello-pepr-watch-data": "This data was stored by a Watch Action.",
        },
        metadata: {
          labels: {
            "pepr.dev-cacheID": "1744214317282",
          },
          name: "pepr-static-test-store",
          namespace: "pepr-system",
        },
      },
      stores: {
        "hello-pepr-example-1": new Storage(),
      },
    };

    (
      storeCache.sendUpdatesAndFlushCache as jest.MockedFunction<
        typeof storeCache.sendUpdatesAndFlushCache
      >
    ).mockResolvedValue({} as Record<string, Operation>);

    await migrateAndSetupWatch(storeMigrationData);
    const [actualCache, actualNamespace, actualName] = (
      storeCache.sendUpdatesAndFlushCache as jest.Mock
    ).mock.calls[0] as [Record<string, Operation>, string, string];

    expect(Log.debug).toHaveBeenCalledWith(expect.anything(), "Pepr Store migration");
    expect(actualNamespace).toBe("pepr-system");
    expect(actualName).toBe("pepr-static-test-store");

    expect(mockPatch).toHaveBeenCalledWith([
      expect.objectContaining({
        op: "add",
        path: "/metadata/labels/pepr.dev-cacheID",
        value: expect.any(String),
      }),
    ]);

    expect(storeCache.sendUpdatesAndFlushCache).toHaveBeenCalled();
    const transformedKeys = Object.keys(actualCache);

    // Make sure we actually get the correct migration
    expect(transformedKeys).toEqual(
      expect.arrayContaining([
        expect.stringMatching("remove:/data/hello-pepr-example-1-"),
        expect.stringMatching("add:/data/hello-pepr-example-1-v2-:was-here"),
        expect.stringMatching("remove:/data/hello-pepr-example-1-data"),
        expect.stringMatching('add:/data/hello-pepr-example-1-v2-data:{"key":"ex-1-val"}'),
      ]),
    );

    expect(setupWatch).toHaveBeenCalled();
  });
});
