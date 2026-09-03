// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const THREAD_STREAM_TYPES = ["thread-stream", "index.d.ts"];
const TRANSFER_LIST_ITEM = "workerThreads.TransferListItem[]";
const TRANSFERABLE = "workerThreads.Transferable[]";

export function applyBuildCompatibilityPatches(npmRoot: string): void {
  const threadStreamTypes = join(npmRoot, ...THREAD_STREAM_TYPES);

  if (!existsSync(threadStreamTypes)) {
    return;
  }

  const currentTypes = readFileSync(threadStreamTypes, "utf8");

  if (!currentTypes.includes(TRANSFER_LIST_ITEM) || currentTypes.includes(TRANSFERABLE)) {
    return;
  }

  writeFileSync(threadStreamTypes, currentTypes.replace(TRANSFER_LIST_ITEM, TRANSFERABLE));
}
