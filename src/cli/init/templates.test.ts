// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it } from "@jest/globals";
import { promises as fs } from "fs";
import path from "path";

// Path to project root - relative to the location of this test file
const projectRoot = path.resolve(__dirname, "../../..");

describe("Template files", () => {
  describe("ESLint configuration", () => {
    it("should ensure eslint.config.mjs and src/templates/eslint.config.mjs are identical", async () => {
      // Get the content of both files
      const rootEslintPath = path.join(projectRoot, "eslint.config.mjs");
      const templateEslintPath = path.join(projectRoot, "src/templates/eslint.config.mjs");

      const rootEslintContent = await fs.readFile(rootEslintPath, "utf-8");
      const templateEslintContent = await fs.readFile(templateEslintPath, "utf-8");

      // Log an additional helpful message before the assertion
      // This way the assertion's diff output will still be shown
      if (rootEslintContent !== templateEslintContent) {
        console.error(
          "ESLint configuration files are not identical!\n" +
            "The root eslint.config.mjs and src/templates/eslint.config.mjs must have the exact same content.\n" +
            "This ensures that Pepr users get the same linting configuration as the Pepr team.\n" +
            "Please update both files to match or run 'cp eslint.config.mjs src/templates/eslint.config.mjs' to copy the root file to the template directory.\n\n" +
            `Root file: ${rootEslintPath}\n` +
            `Template file: ${templateEslintPath}\n`,
        );
      }

      // The regular assertion will fail with a detailed diff when contents don't match
      expect(templateEslintContent).toBe(rootEslintContent);
    });
  });
});
