import { afterEach, describe, expect, jest, it } from "@jest/globals";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/shared-types";
import { Queue } from "./queue";

import Log from "../telemetry/logger";
jest.mock("../telemetry/logger");

describe("Queue", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("is uniquely identifiable", () => {
    const name = "kind/namespace";
    const queue = new Queue(name);

    const label = queue.label();

    expect(label).toEqual(
      expect.objectContaining({
        // given name of queue
        name,

        // unique, generated value (to disambiguate similarly-named queues)
        // <epoch timestamp (ms)>-<4 char hex>
        uid: expect.stringMatching(/[0-9]{13}-[0-9a-f]{4}/),
      }),
    );
  });

  it("exposes runtime stats", async () => {
    const name = "kind/namespace";
    const queue = new Queue(name);

    expect(queue.stats()).toEqual(
      expect.objectContaining({
        queue: queue.label(),
        stats: { length: 0 },
      }),
    );

    const kubeObj = { metadata: { name: "test-nm", namespace: "test-ns" } };
    const watchCb = () =>
      new Promise<void>(res => {
        setTimeout(res, 100);
      });

    await Promise.all([
      queue.enqueue(kubeObj, WatchPhase.Added, watchCb),
      queue.enqueue(kubeObj, WatchPhase.Added, watchCb),
      queue.enqueue(kubeObj, WatchPhase.Added, watchCb),
      queue.enqueue(kubeObj, WatchPhase.Added, watchCb),
    ]);

    const logDebug = Log.debug as jest.Mock;
    const stats = logDebug.mock.calls
      .flat()
      .map(m => JSON.stringify(m))
      .filter(m => m.includes('"stats":'));

    [
      '"length":1', // 1st entry runs near-immediately, so queue won't fill
      '"length":1', // afterward, queue fills & unfills as callbacks process
      '"length":2',
      '"length":3',
      '"length":3',
      '"length":2',
      '"length":1',
      '"length":0',
    ].map((exp, idx) => {
      expect(stats[idx]).toEqual(expect.stringContaining(exp));
    });
  });

  it("resolves when an enqueued event dequeues without error", async () => {
    const name = "kind/namespace";
    const queue = new Queue(name);

    const kubeObj = { metadata: { name: "test-nm", namespace: "test-ns" } };
    const watchCb = () =>
      new Promise<void>(res => {
        setTimeout(res, 10);
      });

    const promise = queue.enqueue(kubeObj, WatchPhase.Added, watchCb);
    expect(promise).toBeInstanceOf(Promise);

    await expect(promise).resolves.not.toThrow();
  });

  it("rejects when an enqueued event dequeues with error", async () => {
    const name = "kind/namespace";
    const queue = new Queue(name);

    const kubeObj = { metadata: { name: "test-nm", namespace: "test-ns" } };
    const watchCb = () =>
      new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject("oof");
        }, 10);
      });

    const promise = queue.enqueue(kubeObj, WatchPhase.Added, watchCb);
    expect(promise).toBeInstanceOf(Promise);

    await expect(promise).rejects.toBe("oof");
  });

  it("processes events in FIFO order", async () => {
    const name = "kind/namespace";
    const queue = new Queue(name);

    const kubeObj = { metadata: { name: "test-nm", namespace: "test-ns" } };
    const watchA = () =>
      new Promise<void>(resolve => {
        setTimeout(() => {
          Log.info("watchA");
          resolve();
        }, 15);
      });
    const watchB = () =>
      new Promise<void>(resolve => {
        setTimeout(() => {
          Log.info("watchB");
          resolve();
        }, 10);
      });
    const watchC = () =>
      new Promise<void>(resolve => {
        setTimeout(() => {
          Log.info("watchC");
          resolve();
        }, 5);
      });

    await Promise.all([
      queue.enqueue(kubeObj, WatchPhase.Added, watchA),
      queue.enqueue(kubeObj, WatchPhase.Added, watchB),
      queue.enqueue(kubeObj, WatchPhase.Added, watchC),
    ]);

    const logInfo = Log.info as jest.Mock;
    const calls = logInfo.mock.calls
      .flat()
      .map(m => JSON.stringify(m))
      .filter(m => /"watch[ABC]"/.test(m));

    ['"watchA"', '"watchB"', '"watchC"'].map((exp, idx) => {
      expect(calls[idx]).toEqual(expect.stringContaining(exp));
    });
  });
});
