// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { ESLint } from "eslint";
import { promises as fs } from "fs";
import { format, resolveConfig } from "prettier";

import { RootCmd } from "./root";

export default function (program: RootCmd) {
  program
    .command("format")
    .description("Lint and format this Pepr module")
    .option("-v, --validate-only", "Do not modify files, only validate formatting")
    .action(async opts => {
      const success = await peprFormat(opts.validateOnly);

      if (success) {
        console.info("✅ Module formatted");
      } else {
        process.exit(1);
      }
    });
}

/**
 * Perform linting and formatting on the module
 * @param validateOnly
 * @returns success
 */
export async function peprFormat(validateOnly: boolean) {
  {
    try {
      const eslint = new ESLint();
      const results = await eslint.lintFiles(["./**/*.ts"]);

      // Track if any files failed
      let hasFailure = false;

      results.forEach(async result => {
        const errorCount = result.fatalErrorCount + result.errorCount;
        if (errorCount > 0) {
          hasFailure = true;
        }
      });

      const formatter = await eslint.loadFormatter("stylish");
      const resultText = await formatter.format(results);

      if (resultText) {
        console.log(resultText);
      }

      // Write the fixes if not in validate-only mode
      if (!validateOnly) {
        await ESLint.outputFixes(results);
      }

      // Format with Prettier
      for (const { filePath } of results) {
        const content = await fs.readFile(filePath, "utf8");
        const cfg = await resolveConfig(filePath);
        const formatted = await format(content, { filepath: filePath, ...cfg });

        // If in validate-only mode, check if the file is formatted correctly
        if (validateOnly) {
          if (formatted !== content) {
            hasFailure = true;
            console.error(`File ${filePath} is not formatted correctly`);
          }
        } else {
          // Otherwise, write the formatted file
          await fs.writeFile(filePath, formatted);
        }
      }

      return !hasFailure;
    } catch (e) {
      console.error(e.message);
      return false;
    }
  }
}
