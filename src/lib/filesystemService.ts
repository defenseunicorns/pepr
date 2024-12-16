// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { promises } from "fs";

export async function createDirectoryIfNotExists(path: string): Promise<void> {
  try {
    await promises.access(path);
  } catch (error) {
    if (error.code === "ENOENT") {
      await promises.mkdir(path, { recursive: true });
    } else {
      throw error;
    }
  }
}
