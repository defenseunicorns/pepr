// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { promises as fs } from "fs";

/**
 * Sanitize a user input name to be used as a pepr module directory name
 *
 * @param name the user input name
 * @returns the sanitized name
 */
export function sanitizeName(name: string): string {
  if (typeof name !== "string") {
    throw TypeError(
      `sanitizeName() was called with a non-string value. The value is: ${name} of type ${typeof name}`,
    );
  }
  // Replace any characters outside of [^a-z0-9-] with "-"
  let sanitized = name.toLowerCase().replace(/[^a-z0-9-]+/gi, "-");

  // Remove any leading or trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, "");

  // Replace multiple hyphens with a single hyphen
  sanitized = sanitized.replace(/--+/g, "-");

  return sanitized;
}

/**
 * Creates a directory and throws an error if it already exists
 *
 * @param dir - The directory to create
 */
export async function createDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir);
  } catch (err) {
    // The directory already exists
    if (err && (err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Directory ${dir} already exists`);
    } else {
      throw err;
    }
  }
}

/**
 * Write data to a file on disk
 * @param path - The path to the file
 * @param data - The data to write
 * @returns A promise that resolves when the file has been written
 */
export function write(path: string, data: unknown): Promise<void> {
  // If the data is not a string, stringify it
  if (typeof data !== "string") {
    data = JSON.stringify(data, null, 2);
  }
  return fs.writeFile(path, data as string);
}
