// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it, beforeAll } from "@jest/globals";
import { promises as fs } from "fs";
import path from "path";

// Path to project main - relative to the location of this test file
const projectmain = path.resolve(__dirname, "../../..");
const mainEslintPath = path.join(projectmain, "eslint.config.mjs");
const templateEslintPath = path.join(projectmain, "src/templates/eslint.config.mjs");

describe(`ESLint template configuration (${templateEslintPath})`, () => {
  // File paths used in all tests
  let mainEslintContent: string;
  let templateEslintContent: string;

  // Helper to extract content matching a pattern
  const extractContent = (content: string, regex: RegExp, groupIndex = 0): string[] => {
    const results: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[groupIndex]) results.push(match[groupIndex].trim());
    }
    return results;
  };

  // Helper to extract string literals from content
  const extractStringLiterals = (content: string): string[] => {
    const literals = extractContent(content, /["']([^"']+)["']/g, 1);
    return [...new Set(literals)]; // Remove duplicates
  };

  // Output error details in a consistent format
  const logErrors = (missingItems: string[]): void => {
    if (missingItems.length === 0) return;

    console.error(
      `The following items in ${templateEslintPath} are missing in ${mainEslintPath}:\n` +
        missingItems.map(item => `  - ${item}`).join("\n") +
        "\n",
    );
  };

  // Before all tests, load the file contents
  beforeAll(async () => {
    mainEslintContent = await fs.readFile(mainEslintPath, "utf-8");
    templateEslintContent = await fs.readFile(templateEslintPath, "utf-8");
  });

  it(`template imports exist in ${mainEslintPath}`, () => {
    // Extract imports
    const importRegex = /import\s+.*?from\s+["']([^"']+)["'];?/g;
    const mainImports = extractContent(mainEslintContent, importRegex, 0);
    const templateImports = extractContent(templateEslintContent, importRegex, 0);

    // Find missing imports
    const missingImports = templateImports.filter(imp => !mainImports.some(ri => ri.includes(imp)));

    logErrors(missingImports);
    expect(missingImports).toHaveLength(0);
  });

  it(`template consts exist in ${mainEslintPath}`, () => {
    // Extract const declarations
    const constRegex = /const\s+([^=]+)\s*=/g;
    const mainConsts = extractContent(mainEslintContent, constRegex, 1);
    const templateConsts = extractContent(templateEslintContent, constRegex, 1);

    // Find missing consts
    const missingConsts = templateConsts.filter(
      c => !mainConsts.some(rc => rc.trim() === c.trim()),
    );

    logErrors(missingConsts);
    expect(missingConsts).toHaveLength(0);
  });

  it(`template eslint rules exist in ${mainEslintPath}`, () => {
    // Extract rules
    const ruleBlockRegex = /rules\s*:\s*{([^}]*)}/g;
    const templateRuleBlocks = extractContent(templateEslintContent, ruleBlockRegex, 1);
    const mainRuleBlocks = extractContent(mainEslintContent, ruleBlockRegex, 1);

    // Get rule names from extracted blocks
    const templateRuleNames = new Set<string>();
    templateRuleBlocks.forEach(block => {
      extractStringLiterals(block)
        .filter(rule => !rule.includes(":"))
        .forEach(rule => templateRuleNames.add(rule));
    });

    const mainRuleNames = new Set<string>();
    mainRuleBlocks.forEach(block => {
      extractStringLiterals(block)
        .filter(rule => !rule.includes(":"))
        .forEach(rule => mainRuleNames.add(rule));
    });

    // Find missing rules
    const missingRules = [...templateRuleNames].filter(rule => !mainRuleNames.has(rule));

    // Log any issues
    if (missingRules.length > 0) {
      console.error(
        "Rules missing in ${mainEslintPath}:\n" +
          missingRules.map(rule => `  - ${rule}`).join("\n") +
          "\n",
      );
      console.error(
        "Template ESLint configuration should be a subset of the ${mainEslintPath}uration.\n" +
          `main file: ${mainEslintPath}\n` +
          `Template file: ${templateEslintPath}\n`,
      );
    }

    expect(missingRules).toHaveLength(0);
  });

  it(`template eslint ignores exist in ${mainEslintPath}`, () => {
    // Extract ignores
    const ignoresRegex = /ignores\s*:\s*\[([^\]]+)\]/g;
    const templateIgnoresBlocks = extractContent(templateEslintContent, ignoresRegex, 1);
    const mainIgnoresBlocks = extractContent(mainEslintContent, ignoresRegex, 1);

    // Get ignore patterns
    const templateIgnores = new Set<string>();
    templateIgnoresBlocks.forEach(block => {
      extractStringLiterals(block).forEach(ignore => templateIgnores.add(ignore));
    });

    const mainIgnores = new Set<string>();
    mainIgnoresBlocks.forEach(block => {
      extractStringLiterals(block).forEach(ignore => mainIgnores.add(ignore));
    });

    // Find missing ignores
    const missingIgnores = [...templateIgnores].filter(ignore => !mainIgnores.has(ignore));

    // Log any issues
    if (missingIgnores.length > 0) {
      console.error(
        "Ignores missing in ${mainEslintPath}:\n" +
          missingIgnores.map(ignore => `  - ${ignore}`).join("\n") +
          "\n",
      );
      console.error(
        "Template ESLint configuration should be a subset of the ${mainEslintPath}uration.\n" +
          `main file: ${mainEslintPath}\n` +
          `Template file: ${templateEslintPath}\n`,
      );
    }

    expect(missingIgnores).toHaveLength(0);
  });
});
