// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { promises as fs } from "fs";

/**
 * Sanitizes a user input name to be used as a Pepr module directory name.
 *
 * @param {string} name - The user input name.
 * @returns {string} The sanitized name.
 */
export function sanitizeName(name) {
  const sanitized = name.toLowerCase().replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").replace(/--+/g, "-");
  return sanitized;
}

/**
 * Creates a directory and throws an error if it already exists.
 *
 * @param {string} dir - The directory to create.
 * @throws {Error} If the directory already exists.
 */
export async function createDir(dir) {
  try {
    await fs.mkdir(dir);
  } catch (err) {
    if (err.code === "EEXIST") {
      throw new Error(`Directory ${dir} already exists`);
    }
    throw err;
  }
}

/**
 * Writes data to a file on disk.
 *
 * @param {string} path - The path to the file.
 * @param {unknown} data - The data to write.
 * @returns {Promise<void>} A promise that resolves when the file has been written.
 */
export function write(path, data) {
  const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return fs.writeFile(path, content);
}