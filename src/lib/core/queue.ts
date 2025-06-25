// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { KubernetesObject } from "@kubernetes/client-node";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/shared-types";
import { randomBytes } from "node:crypto";
import Log from "../telemetry/logger";

type WatchCallback = (obj: KubernetesObject, phase: WatchPhase) => Promise<void>;

type QueueItem<K extends KubernetesObject> = {
  item: K;
  phase: WatchPhase;
  callback: WatchCallback;
  resolve: (value: void | PromiseLike<void>) => void;
  reject: (reason?: string) => void;
};

/**
 * Queue is a FIFO queue for reconciling
 */
export class Queue<K extends KubernetesObject> {
  #name: string;
  #uid: string;
  #queue: QueueItem<K>[] = [];
  #pendingPromise = false;

  constructor(name: string) {
    this.#name = name;
    this.#uid = `${Date.now()}-${randomBytes(2).toString("hex")}`;
  }

  label(): { name: string; uid: string } {
    return { name: this.#name, uid: this.#uid };
  }

  stats(): {
    queue: {
      name: string;
      uid: string;
    };
    stats: {
      length: number;
    };
  } {
    return {
      queue: this.label(),
      stats: {
        length: this.#queue.length,
      },
    };
  }

  /**
   * Enqueue adds an item to the queue and returns a promise that resolves when the item is
   * reconciled.
   *
   * @param item The object to reconcile
   * @param type The watch phase requested for reconcile
   * @param reconcile The callback to enqueue for reconcile
   * @returns A promise that resolves when the object is reconciled
   */
  enqueue(item: K, phase: WatchPhase, reconcile: WatchCallback): Promise<void> {
    const note = {
      queue: this.label(),
      item: {
        name: item.metadata?.name,
        namespace: item.metadata?.namespace,
        resourceVersion: item.metadata?.resourceVersion,
      },
    };
    Log.debug(note, "Enqueueing");
    return new Promise<void>((resolve, reject) => {
      this.#queue.push({ item, phase, callback: reconcile, resolve, reject });
      Log.debug(this.stats(), "Queue stats - push");
      return this.#dequeue();
    });
  }

  /**
   * Dequeue reconciles the next item in the queue
   *
   * @returns A promise that resolves when the webapp is reconciled
   */
  async #dequeue(): Promise<false | undefined> {
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
      const note = {
        queue: this.label(),
        item: {
          name: element.item.metadata?.name,
          namespace: element.item.metadata?.namespace,
          resourceVersion: element.item.metadata?.resourceVersion,
        },
      };
      Log.debug(note, "Reconciling");
      await element.callback(element.item, element.phase);
      Log.debug(note, "Reconciled");

      element.resolve();
    } catch (e) {
      Log.debug(`Error reconciling ${element.item.metadata!.name}`, { error: e });
      element.reject(e);
    } finally {
      Log.debug(this.stats(), "Queue stats - shift");

      // Reset the pending promise flag
      Log.debug("Resetting pending promise and dequeuing");
      this.#pendingPromise = false;

      // After the element is reconciled, dequeue the next element
      await this.#dequeue();
    }
  }
}
