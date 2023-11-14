// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { promises as fs } from "fs";
import { resolve } from "path";

import { cwd } from "./entrypoint.test";

export async function before() {
  
  const dir = resolve(cwd);

  try {
    await fs.access(dir);
    await fs.rm(dir, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
      // The directory does not exist, do nothing
    }
  }
}
