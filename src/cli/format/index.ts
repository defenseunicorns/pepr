// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { ESLint } from "eslint";
import { formatWithPrettier } from "./format.helpers";

import { RootCmd } from "../root";

export default function (program: RootCmd): void {
  program
    .command("format")
    .description("Lint and format this Pepr module")
    .option("-v, --validate-only", "Do not modify files, only validate formatting. - UNDOCUMENTED!")
    .helpOption("-h, --help", "Display help for command")
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
export async function peprFormat(validateOnly: boolean): Promise<boolean> {
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
      const resultText = await formatter.format(results, {} as ESLint.LintResultData);

      if (resultText) {
        console.log(resultText);
      }

      // Write the fixes if not in validate-only mode
      if (!validateOnly) {
        await ESLint.outputFixes(results);
      }

      hasFailure = await formatWithPrettier(results, validateOnly);

      return !hasFailure;
    } catch (e) {
      console.error(`Error formatting module:`, e);
      return false;
    }
  }
}
