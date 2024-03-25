// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { KubernetesObject } from "@kubernetes/client-node";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";
import Log from "./logger";

type QueueItem<K extends KubernetesObject> = {
  item: K;
  type: WatchPhase;
  resolve: (value: void | PromiseLike<void>) => void;
  reject: (reason?: string) => void;
};

/**
 * Queue is a FIFO queue for reconciling
 */
export class Queue<K extends KubernetesObject> {
  #queue: QueueItem<K>[] = [];
  #pendingPromise = false;
  #reconcile?: (obj: KubernetesObject, type: WatchPhase) => Promise<void>;

  constructor() {
    this.#reconcile = async () => await new Promise(resolve => resolve());
  }

  setReconcile(reconcile: (obj: KubernetesObject, type: WatchPhase) => Promise<void>) {
    this.#reconcile = reconcile;
  }

  /**
   * Enqueue adds an item to the queue and returns a promise that resolves when the item is
   * reconciled.
   *
   * @param item The object to reconcile
   * @returns A promise that resolves when the object is reconciled
   */
  enqueue(item: K, type: WatchPhase) {
    Log.debug(`Enqueueing ${item.metadata!.namespace}/${item.metadata!.name}`);
    return new Promise<void>((resolve, reject) => {
      this.#queue.push({ item, type, resolve, reject });
      return this.#dequeue();
    });
  }

  /**
   * Dequeue reconciles the next item in the queue
   *
   * @returns A promise that resolves when the webapp is reconciled
   */
  async #dequeue() {
    // If there is a pending promise, do nothing
    if (this.#pendingPromise) {
      Log.debug("Pending promise, not dequeuing");
      return false;
    }

    // Take the next element from the queue
    const element = this.#queue.shift();

    // If there is no element, do nothing
    if (!element) {
      Log.debug("No element, not dequeuing");
      return false;
    }

    try {
      // Set the pending promise flag to avoid concurrent reconciliations
      this.#pendingPromise = true;

      // Reconcile the element
      if (this.#reconcile) {
        Log.debug(`Reconciling ${element.item.metadata!.name}`);
        await this.#reconcile(element.item, element.type);
      }

      element.resolve();
    } catch (e) {
      Log.debug(`Error reconciling ${element.item.metadata!.name}`, { error: e });
      element.reject(e);
    } finally {
      // Reset the pending promise flag
      Log.debug("Resetting pending promise and dequeuing");
      this.#pendingPromise = false;

      // After the element is reconciled, dequeue the next element
      await this.#dequeue();
    }
  }
}
