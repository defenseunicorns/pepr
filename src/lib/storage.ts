// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import Log from "./logger";

export interface PeprStore {
  /**
   * Returns the current value associated with the given key, or null if the given key does not exist.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Storage/getItem)
   */
  getItem(key: string): string | null;
  /**
   * Removes all key/value pairs, if there are any.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Storage/clear)
   */
  clear(): Promise<void>;
  /**
   * Removes the key/value pair with the given key, if a key/value pair with the given key exists.
   *
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Storage/removeItem)
   */
  removeItem(key: string): Promise<void>;
  /**
   * Sets the value of the pair identified by key to value, creating a new key/value pair if none existed for key previously.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Storage/setItem)
   */
  setItem(key: string, value: string): Promise<void>;
}

export type DataOp = "add" | "remove";
export type DataStore = Record<string, string>;
export type DataSender = (op: DataOp, keys: string[], value?: string) => Promise<void>;
export type DataReceiver = (data: DataStore) => void;

/**
 * A key-value data store that can be used to persist data that should be shared
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Storage)
 */
export class Storage implements PeprStore {
  private _store: DataStore = {};

  private _send!: DataSender;

  constructor() {}

  registerSender = (send: DataSender) => {
    this._send = send;
  };

  receive: DataReceiver = (data: DataStore) => {
    Log.debug(`Pepr store data update: ${JSON.stringify(data)}`);
    this._store = data || {};
  };

  getItem = (key: string) => {
    // Return null if the value is the empty string
    return this._store[key] || null;
  };

  clear = async () => {
    await this._dispatchUpdate("remove", Object.keys(this._store));
  };

  removeItem = async (key: string) => {
    await this._dispatchUpdate("remove", [key]);
  };

  setItem = async (key: string, value: string) => {
    await this._dispatchUpdate("add", [key], value);
  };

  private async _dispatchUpdate(op: DataOp, keys: string[], value?: string) {
    await this._send(op, keys, value);
  }
}
