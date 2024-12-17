// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { ESLint } from "eslint";
import { promises as fs } from "fs";
import { format, resolveConfig } from "prettier";

export async function formatWithPrettier(
  results: ESLint.LintResult[],
  validateOnly: boolean,
): Promise<boolean> {
  let hasFailure = false;
  for (const { filePath } of results) {
    const content = await fs.readFile(filePath, "utf8");
    const cfg = await resolveConfig(filePath);
    const formatted = await format(content, { filepath: filePath, ...cfg });

    // If in validate-only mode, check if the file is formatted correctly
    if (validateOnly && formatted !== content) {
      hasFailure = true;
      console.error(`File ${filePath} is not formatted correctly`);
    } else {
      await fs.writeFile(filePath, formatted);
    }
  }
  return hasFailure;
}
