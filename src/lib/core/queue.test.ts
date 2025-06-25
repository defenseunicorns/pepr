import { beforeEach, describe, expect, vi, it } from "vitest";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/shared-types";
import { Queue } from "./queue";
import Log from "../telemetry/logger";
import { KubernetesObject } from "kubernetes-fluent-client";

vi.mock("../telemetry/logger");

/**
 * Creates a watch function that resolves or rejects after the specified timeout
 * @param name The name to log when the function executes. If name starts with "error:", the promise will reject with the rest of the name
 * @param timeout The timeout in milliseconds before resolving/rejecting
 * @returns A function that returns a Promise that resolves or rejects after the timeout
 */
const createWatchFn =
  (name: string, timeout: number): (() => Promise<void>) =>
  (): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        Log.info(name);
        if (name.startsWith("error:")) {
          reject(name.substring(6).trim() || "Error occurred");
        }
        resolve();
      }, timeout);
    });

describe("Queue Processing", () => {
  let queue: Queue<KubernetesObject>;
  const queueName = "kind/namespace";
  const kubeObj = { metadata: { name: "test-nm", namespace: "test-ns" } };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(Log.debug, true).mockImplementation(vi.fn());
    vi.mocked(Log.info, true).mockImplementation(vi.fn());
    queue = new Queue(queueName);
  });

  describe("Given a new created Queue", () => {
    it("should be uniquely identifiable", () => {
      const label = queue.label();

      expect(label).toEqual(
        expect.objectContaining({
          name: queueName,

          // Should contain a unique, generated value to disambiguate similarly-named queues
          // Format: <epoch timestamp (ms)>-<4 char hex>
          uid: expect.stringMatching(/[0-9]{13}-[0-9a-f]{4}/),
        }),
      );
    });

    it("should show an empty queue", () => {
      const initialStats = queue.stats();

      expect(initialStats).toEqual(
        expect.objectContaining({
          queue: queue.label(),
          stats: { length: 0 },
        }),
      );
    });
  });

  describe("when there are multiple items", () => {
    it("should track queue length correctly in the stats", async () => {
      await Promise.all(
        Array.from({ length: 4 }).map(() =>
          queue.enqueue(kubeObj, WatchPhase.Added, createWatchFn("callback", 5)),
        ),
      );

      const stats = vi
        .mocked(Log.debug)
        .mock.calls.map(m => JSON.stringify(m))
        .filter(m => m.includes('"stats":'));

      // Expected queue lengths at different processing stages
      const expectedLengths = [
        '"length":1', // 1st entry runs near-immediately, so queue won't fill
        '"length":1', // afterward, queue fills & unfills as callbacks process
        '"length":2',
        '"length":3',
        '"length":3',
        '"length":2',
        '"length":1',
        '"length":0',
      ];

      expectedLengths.forEach((expectedLength, index) => {
        expect(stats[index]).toEqual(expect.stringContaining(expectedLength));
      });
    });
  });
  describe("When the queue processes a passing item", () => {
    it("should resolve the promise", async () => {
      const promise = queue.enqueue(
        kubeObj,
        WatchPhase.Added,
        createWatchFn("successCallback", 10),
      );
      expect(promise).toBeInstanceOf(Promise);
      await expect(promise).resolves.not.toThrow();
    });
  });

  describe("When the queue processes a failing item", () => {
    it("should reject with an error", async () => {
      const promise = queue.enqueue(kubeObj, WatchPhase.Added, createWatchFn("error: oof", 10));

      expect(promise).toBeInstanceOf(Promise);
      await expect(promise).rejects.toBe("oof");
    });
  });

  describe("when items enqueue simultaneously", () => {
    it("should process them in FIFO (first-in, first-out) order", async () => {
      await Promise.all([
        queue.enqueue(kubeObj, WatchPhase.Added, createWatchFn("watchA", 15)), // Slowest
        queue.enqueue(kubeObj, WatchPhase.Added, createWatchFn("watchB", 10)), // Medium
        queue.enqueue(kubeObj, WatchPhase.Added, createWatchFn("watchC", 5)), // Fastest
      ]);

      const calls = vi
        .mocked(Log.info)
        .mock.calls.flat()
        .map(m => JSON.stringify(m))
        .filter(m => /"watch[ABC]"/.test(m));

      // Expected order: A, B, C (enqueue order) not C, B, A (completion time order)
      const expectedOrder = ['"watchA"', '"watchB"', '"watchC"'];

      expectedOrder.forEach((expectedCall, index) => {
        expect(calls[index]).toEqual(expect.stringContaining(expectedCall));
      });
    });
  });
});
