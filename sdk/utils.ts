// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

/**
 * The deepFreeze function recursively freezes an object and all of its properties.
 *
 * @param obj
 * @returns
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  // Retrieve the property names defined on obj
  const propNames = Object.getOwnPropertyNames(obj);

  // Freeze properties before freezing self
  for (const name of propNames) {
    const value = (obj as any)[name];
    if (value && typeof value === "object") {
      deepFreeze(value);
    }
  }

  // Freeze self (no-op if already frozen)
  return Object.freeze(obj);
}
