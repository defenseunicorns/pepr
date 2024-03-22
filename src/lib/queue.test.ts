import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { KubernetesObject } from "@kubernetes/client-node";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";
import { Queue } from "./queue";

describe("Queue", () => {
  let queue: Queue<KubernetesObject>;

  beforeEach(() => {
    queue = new Queue();
  });

  test("enqueue should add a pod to the queue and return a promise", async () => {
    const pod = {
      metadata: { name: "test-pod", namespace: "test-pod" },
    };
    const promise = queue.enqueue(pod, WatchPhase.Added);
    expect(promise).toBeInstanceOf(Promise);
    await promise;
  });

  test("dequeue should process pods in FIFO order", async () => {
    const mockPod = {
      metadata: { name: "test-pod", namespace: "test-namespace" },
    };
    const mockPod2 = {
      metadata: { name: "test-pod-2", namespace: "test-namespace-2" },
    };

    // Enqueue two packages
    const promise1 = queue.enqueue(mockPod, WatchPhase.Added);
    const promise2 = queue.enqueue(mockPod2, WatchPhase.Modified);

    // Wait for both promises to resolve
    await promise1;
    await promise2;
  });

  test("dequeue should handle errors in pod processing", async () => {
    const mockPod = {
      metadata: { name: "test-pod", namespace: "test-namespace" },
    };
    const error = new Error("reconciliation failed");
    jest.spyOn(queue, "setReconcile").mockRejectedValueOnce(error as never);

    try {
      await queue.enqueue(mockPod, WatchPhase.Added);
    } catch (e) {
      expect(e).toBe(error);
    }

    // Ensure that the queue is ready to process the next pod
    const mockPod2 = {
      metadata: { name: "test-pod-2", namespace: "test-namespace-2" },
    };
    await queue.enqueue(mockPod2, WatchPhase.Modified);
  });
});
