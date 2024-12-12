// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { promises as fs } from "fs";
import { resolve, join } from "path";

/**
 * Removes a folder and all its contents recursively.
 * @param folderPath - The path to the folder to remove.
 */
export async function removeFolder(folderPath: string): Promise<void> {
  const dir = resolve(folderPath);

  try {
    await fs.access(dir);
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // Folder is not there, do nothing
    } else {
      throw error;
    }
  }
}
