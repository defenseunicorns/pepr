import { afterEach, beforeEach, describe, expect, vi, it } from "vitest";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";
import { Queue } from "./queue";
import Log from "../telemetry/logger";
import { KubernetesObject } from "kubernetes-fluent-client";

vi.mock("../telemetry/logger");

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(Log.debug, true).mockImplementation(vi.fn());
  vi.mocked(Log.info, true).mockImplementation(vi.fn());
});

describe("Queue Processing", () => {
  let queue: Queue<KubernetesObject>;
  const queueName = "kind/namespace";
  const kubeObj = { metadata: { name: "test-nm", namespace: "test-ns" } };

  beforeEach(() => {
    queue = new Queue(queueName);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Given a new created Queue", () => {
    describe("When requesting its label", () => {
      it("Then it should be uniquely identifiable", () => {
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
    });

    describe("When requesting stats", () => {
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
  });

  describe("when there are multiple items", () => {
    it("Then it should track queue length correctly in the stats", async () => {
      const watchCallback = (): Promise<void> =>
        new Promise<void>(res => {
          setTimeout(res, 100);
        });

      await Promise.all(
        Array.from({ length: 4 }).map(() =>
          queue.enqueue(kubeObj, WatchPhase.Added, watchCallback),
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

      expectedLengths.forEach((expectedLength, idx) => {
        expect(stats[idx]).toEqual(expect.stringContaining(expectedLength));
      });
    });
  });
  describe("When the queue processes an item", () => {
    it("the returned promise resolves", async () => {
      const successCallback = (): Promise<void> =>
        new Promise<void>(resolve => {
          setTimeout(resolve, 10);
        });

      const promise = queue.enqueue(kubeObj, WatchPhase.Added, successCallback);

      expect(promise).toBeInstanceOf(Promise);
      await expect(promise).resolves.not.toThrow();
    });
  });

  describe("Given an enqueued item with a callback that fails", () => {
    describe("When the queue processes the item", () => {
      it("Then the returned promise should reject with the error", async () => {
        const errorCallback = (): Promise<void> =>
          new Promise<void>((_, reject) => {
            setTimeout(() => {
              reject("oof");
            }, 10);
          });

        const promise = queue.enqueue(kubeObj, WatchPhase.Added, errorCallback);

        expect(promise).toBeInstanceOf(Promise);
        await expect(promise).rejects.toBe("oof");
      });
    });
  });

  describe("Given multiple items enqueued simultaneously", () => {
    describe("When the queue processes all items", () => {
      it("Then it should process them in FIFO (first-in, first-out) order", async () => {
        const watchA = (): Promise<void> =>
          new Promise<void>(resolve => {
            setTimeout(() => {
              Log.info("watchA");
              resolve();
            }, 15); // Slowest
          });

        const watchB = (): Promise<void> =>
          new Promise<void>(resolve => {
            setTimeout(() => {
              Log.info("watchB");
              resolve();
            }, 10); // Medium
          });

        const watchC = (): Promise<void> =>
          new Promise<void>(resolve => {
            setTimeout(() => {
              Log.info("watchC");
              resolve();
            }, 5); // Fastest
          });

        await Promise.all([
          queue.enqueue(kubeObj, WatchPhase.Added, watchA),
          queue.enqueue(kubeObj, WatchPhase.Added, watchB),
          queue.enqueue(kubeObj, WatchPhase.Added, watchC),
        ]);

        const calls = vi
          .mocked(Log.info)
          .mock.calls.flat()
          .map(m => JSON.stringify(m))
          .filter(m => /"watch[ABC]"/.test(m));

        // Expected order: A, B, C (enqueue order) not C, B, A (completion time order)
        const expectedOrder = ['"watchA"', '"watchB"', '"watchC"'];

        expectedOrder.forEach((expectedCall, idx) => {
          expect(calls[idx]).toEqual(expect.stringContaining(expectedCall));
        });
      });
    });
  });
});
