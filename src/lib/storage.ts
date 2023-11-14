// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { clone } from "ramda";
import Log from "./logger";

export type DataOp = "add" | "remove";
export type DataStore = Record<string, string>;
export type DataSender = (op: DataOp, keys: string[], value?: string) => void;
export type DataReceiver = (data: DataStore) => void;
export type Unsubscribe = () => void;

const MAX_WAIT_TIME = 15000;
export interface PeprStore {
  /**
   * Returns the current value associated with the given key, or null if the given key does not exist.
   */
  getItem(key: string): string | null;
  /**
   * Removes all key/value pairs, if there are any.
   */
  clear(): void;
  /**
   * Removes the key/value pair with the given key, if a key/value pair with the given key exists.
   */
  removeItem(key: string): void;
  /**
   * Sets the value of the pair identified by key to value, creating a new key/value pair if none existed for key previously.
   */
  setItem(key: string, value: string): void;

  /**
   * Subscribe to changes in the store. This API behaves similarly to the [Svelte Store API](https://vercel.com/docs/beginner-sveltekit/svelte-stores#using-the-store).
   *
   * @param listener - The callback to be invoked when the store changes.
   * @returns A function to unsubscribe from the listener.
   */
  subscribe(listener: DataReceiver): Unsubscribe;

  /**
   * Register a function to be called when the store is ready.
   */
  onReady(callback: DataReceiver): void;

  /**
   * Sets the value of the pair identified by key to value, creating a new key/value pair if none existed for key previously.
   * Resolves when the key/value show up in the store.
   */
  setItemAndWait(key: string, value: string): Promise<void>;
}

/**
 * A key-value data store that can be used to persist data that should be shared across Pepr controllers and capabilities.
 *
 * The API is similar to the [Storage API](https://developer.mozilla.org/docs/Web/API/Storage)
 */
export class Storage implements PeprStore {
  #store: DataStore = {};
  #send!: DataSender;
  #subscribers: Record<number, DataReceiver> = {};
  #subscriberId = 0;
  #readyHandlers: DataReceiver[] = [];

  registerSender = (send: DataSender) => {
    this.#send = send;
  };

  receive = (data: DataStore) => {
    Log.debug(data, `Pepr store data received`);
    this.#store = data || {};

    this.#onReady();

    // Notify all subscribers
    for (const idx in this.#subscribers) {
      // Send a unique clone of the store to each subscriber
      this.#subscribers[idx](clone(this.#store));
    }
  };

  getItem = (key: string) => {
    // Return null if the value is the empty string
    return this.#store[key] || null;
  };

  clear = () => {
    this.#dispatchUpdate("remove", Object.keys(this.#store));
  };

  removeItem = (key: string) => {
    this.#dispatchUpdate("remove", [key]);
  };

  setItem = (key: string, value: string) => {
    this.#dispatchUpdate("add", [key], value);
  };

  /**
   * Creates a promise and subscribes to the store, the promise resolves when
   * the key and value are seen in the store.
   *
   * @param key - The key to add into the store
   * @param value - The value of the key
   * @returns
   */
  setItemAndWait = (key: string, value: string) => {
    this.#dispatchUpdate("add", [key], value);
    return new Promise<void>((resolve, reject) => {
      const unsubscribe = this.subscribe(data => {
        if (data[key] === value) {
          unsubscribe();
          resolve();
        }
      });

      // If promise has not resolved before MAX_WAIT_TIME reject
      setTimeout(() => {
        unsubscribe();
        return reject();
      }, MAX_WAIT_TIME);
    });
  };

  subscribe = (subscriber: DataReceiver) => {
    const idx = this.#subscriberId++;
    this.#subscribers[idx] = subscriber;
    return () => this.unsubscribe(idx);
  };

  onReady = (callback: DataReceiver) => {
    this.#readyHandlers.push(callback);
  };

  /**
   * Remove a subscriber from the list of subscribers.
   * @param idx - The index of the subscriber to remove.
   */
  unsubscribe = (idx: number) => {
    delete this.#subscribers[idx];
  };

  #onReady = () => {
    // Notify all ready handlers with a clone of the store
    for (const handler of this.#readyHandlers) {
      handler(clone(this.#store));
    }

    // Make this a noop so that it can't be called again
    this.#onReady = () => {};
  };

  /**
   * Dispatch an update to the store and notify all subscribers.
   * @param  op - The type of operation to perform.
   * @param  keys - The keys to update.
   * @param  [value] - The new value.
   */
  #dispatchUpdate = (op: DataOp, keys: string[], value?: string) => {
    this.#send(op, keys, value);
  };
}
