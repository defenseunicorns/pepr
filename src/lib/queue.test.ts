import { beforeEach, expect, jest, describe, test } from "@jest/globals";
import { Queue } from "./queue";
import { KubernetesObject } from "@kubernetes/client-node";
describe("Queue", () => {
  let queue: Queue<KubernetesObject>;

  beforeEach(() => {
    queue = new Queue();
  });

  test("enqueue should add a pod to the queue and return a promise", async () => {
    const pod = {
      metadata: { name: "test-pod", namespace: "test-pod" },
    };
    const promise = queue.enqueue(pod);
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
    const promise1 = queue.enqueue(mockPod);
    const promise2 = queue.enqueue(mockPod2);

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
      await queue.enqueue(mockPod);
    } catch (e) {
      expect(e).toBe(error);
    }

    // Ensure that the queue is ready to process the next pod
    const mockPod2 = {
      metadata: { name: "test-pod-2", namespace: "test-namespace-2" },
    };
    await queue.enqueue(mockPod2);
  });
});
