import { migrateAndSetupWatch, StoreMigration } from "./migrateStore";
import Log from "../telemetry/logger";
import * as storeCache from "./storeCache";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Operation } from "fast-json-patch";
import { Storage } from "../core/storage";

const mockPatch = vi.fn();
const setupWatch = vi.fn();
vi.mock("../telemetry/logger", () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    debug: vi.fn(),
  },
  redactedStore: vi.fn(x => x),
}));

vi.mock("kubernetes-fluent-client", async () => {
  const actualKFC = await vi.importActual<typeof import("kubernetes-fluent-client")>(
    "kubernetes-fluent-client",
  );
  return {
    ...actualKFC,
    K8s: vi.fn().mockImplementation(() => ({
      Patch: mockPatch,
    })),
  };
});
vi.mock("./storeCache", async () => {
  const actualStore = await vi.importActual<typeof import("./storeCache")>("./storeCache");
  return {
    ...actualStore,
    sendUpdatesAndFlushCache: vi.fn(),
  };
});

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

describe("migrateAndSetupWatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should should patch the stor with a pepr.dev-cacheID label", async () => {
    await migrateAndSetupWatch(storeMigrationData);
    expect(mockPatch).toHaveBeenCalledWith([
      expect.objectContaining({
        op: "add",
        path: "/metadata/labels/pepr.dev-cacheID",
        value: expect.any(String),
      }),
    ]);
  });

  it("should transform keys to v2 with correct values", async () => {
    await migrateAndSetupWatch(storeMigrationData);
    const [actualCache] = (storeCache.sendUpdatesAndFlushCache as Mock).mock.calls[0] as [
      Record<string, Operation>,
    ];
    const mockedStoreCache = vi.mocked(storeCache);
    mockedStoreCache.sendUpdatesAndFlushCache.mockResolvedValue({} as Record<string, Operation>);
    // (
    //   storeCache.sendUpdatesAndFlushCache as vi.MockedFunction<
    //     typeof storeCache.sendUpdatesAndFlushCache
    //   >
    // ).mockResolvedValue({} as Record<string, Operation>);

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
  });

  it("should call sendUpdatesAndFlushCache with correct name and namespace", async () => {
    const sendUpdateAndFlushCacheMock = vi.mocked(storeCache.sendUpdatesAndFlushCache);
    await migrateAndSetupWatch(storeMigrationData);
    const [actualCache, actualNamespace, actualName] = sendUpdateAndFlushCacheMock.mock
      .calls[0] as [Record<string, Operation>, string, string];
    // const [actualCache, actualNamespace, actualName] = (
    //   storeCache.sendUpdatesAndFlushCache as jest.Mock
    // ).mock.calls[0] as [Record<string, Operation>, string, string];

    expect(actualCache).toBeDefined();
    expect(actualNamespace).toBe("pepr-system");
    expect(actualName).toBe("pepr-static-test-store");
  });

  it("should call setupWatch", async () => {
    await migrateAndSetupWatch(storeMigrationData);
    expect(setupWatch).toHaveBeenCalled();
  });

  it("should not transform keys when store is empty", async () => {
    const sendUpdateAndFlushCacheMock = vi.mocked(storeCache.sendUpdatesAndFlushCache);
    const emptyStoreMigrationData: StoreMigration = {
      ...storeMigrationData,
      store: {
        ...storeMigrationData.store,
        data: {},
      },
    };
    await migrateAndSetupWatch(emptyStoreMigrationData);
    const [actualCache] = sendUpdateAndFlushCacheMock.mock.calls[0] as unknown as [
      Record<string, Operation>,
    ];
    expect(actualCache).toEqual({});
  });

  it("should log that the store is being migrated for easier debugging through the logs", async () => {
    await migrateAndSetupWatch(storeMigrationData);
    expect(Log.debug).toHaveBeenCalledWith(expect.anything(), "Pepr Store migration");
  });
});
