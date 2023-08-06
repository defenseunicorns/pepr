// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { clone } from "ramda";
import Log from "./logger";

export type DataOp = "add" | "remove";
export type DataStore = Record<string, string>;
export type DataSender = (op: DataOp, keys: string[], value?: string) => void;
export type DataReceiver = (data: DataStore) => void;
export type Unsubscribe = () => void;

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
}

/**
 * A key-value data store that can be used to persist data that should be shared across Pepr controllers and capabilities.
 *
 * The API is similar to the [Storage API](https://developer.mozilla.org/docs/Web/API/Storage)
 */
export class Storage implements PeprStore {
  private _store: DataStore = {};

  private _send!: DataSender;

  private _subscribers: Record<number, DataReceiver> = {};

  private _subscriberId = 0;

  private _readyHandlers: DataReceiver[] = [];

  constructor() {}

  registerSender = (send: DataSender) => {
    this._send = send;
  };

  receive: DataReceiver = (data: DataStore) => {
    Log.debug(data, `Pepr store data received`);
    this._store = data || {};

    this._onReady();

    // Notify all subscribers
    for (const idx in this._subscribers) {
      // Send a unique clone of the store to each subscriber
      this._subscribers[idx](clone(this._store));
    }
  };

  getItem = (key: string) => {
    // Return null if the value is the empty string
    return this._store[key] || null;
  };

  clear = () => {
    this._dispatchUpdate("remove", Object.keys(this._store));
  };

  removeItem = (key: string) => {
    this._dispatchUpdate("remove", [key]);
  };

  setItem = (key: string, value: string) => {
    this._dispatchUpdate("add", [key], value);
  };

  subscribe = (subscriber: DataReceiver) => {
    const idx = this._subscriberId++;
    this._subscribers[idx] = subscriber;
    return () => this.unsubscribe(idx);
  };

  onReady = (callback: DataReceiver) => {
    this._readyHandlers.push(callback);
  };

  /**
   * Remove a subscriber from the list of subscribers.
   * @param idx - The index of the subscriber to remove.
   */
  unsubscribe = (idx: number) => {
    delete this._subscribers[idx];
  };

  private _onReady = () => {
    // Notify all ready handlers with a clone of the store
    for (const handler of this._readyHandlers) {
      handler(clone(this._store));
    }

    // Make this a noop so that it can't be called again
    this._onReady = () => {};
  };

  /**
   * Dispatch an update to the store and notify all subscribers.
   * @param  op - The type of operation to perform.
   * @param  keys - The keys to update.
   * @param  [value] - The new value.
   */
  private _dispatchUpdate(op: DataOp, keys: string[], value?: string) {
    this._send(op, keys, value);
  }
}
