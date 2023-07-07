// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

/**
 * This Web Storage API interface provides access to a particular domain's session or local storage. It allows, for example, the addition, modification, or deletion of stored data items.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Storage)
 */
export class Storage {
  // The internal data store
  private _store: Record<string, string> = {};

  // Track if the store is ready to be used
  private _ready = false;

  constructor(private name: string) {}

  /** Check if the store is ready */
  get isReady() {
    return this._ready;
  }

  /**
   * Returns the number of key/value pairs.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Storage/length)
   */
  get length() {
    return Object.keys(this._store).length;
  }

  /**
   * Removes all key/value pairs, if there are any.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Storage/clear)
   */
  clear() {
    this._store = {};
    this._dispatchUpdate();
  }

  /**
   * Returns the current value associated with the given key, or null if the given key does not exist.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Storage/getItem)
   */
  getItem(key: string) {
    return this._store[key] || null;
  }

  /**
   * Removes the key/value pair with the given key, if a key/value pair with the given key exists.
   *
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Storage/removeItem)
   */
  removeItem(key: string) {
    delete this._store[key];
    this._dispatchUpdate();
  }

  /**
   * Sets the value of the pair identified by key to value, creating a new key/value pair if none existed for key previously.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Storage/setItem)
   */
  setItem(key: string, value: string) {
    this._store[key] = value;
    this._dispatchUpdate();
  }

  private _dispatchUpdate() {
    console.log("dispatch update");
    // TODO: Dispatch storage event
  }
}
