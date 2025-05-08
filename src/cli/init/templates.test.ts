// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it, beforeAll } from "@jest/globals";
import { promises as fs } from "fs";
import path from "path";

// Path definitions
const projectRoot = path.resolve(__dirname, "../../..");
const rootConfig = path.join(projectRoot, "eslint.config.mjs");
const templateConfig = path.join(projectRoot, "src/templates/eslint.config.mjs.txt");

// Define config item types to check
type ConfigType = "imports" | "consts" | "rules" | "ignores" | "languageOptions";
type ConfigItem = {
  type: ConfigType;
  matcher: RegExp;
  nameGroupIndex?: number;
  contentGroupIndex?: number;
  keySettings?: string[];
};

// Test suite for comparing ESLint configuration files
describe(`ESLint Template Configuration (${templateConfig})`, () => {
  let rootContent = "";
  let templateContent = "";

  // Define extractors for different config item types
  const configItems: ConfigItem[] = [
    {
      type: "imports",
      matcher: /import\s+.*?from\s+["']([^"']+)["'];?/g,
    },
    {
      type: "consts",
      matcher: /const\s+([^=]+)\s*=/g,
      nameGroupIndex: 1,
    },
    {
      type: "rules",
      matcher: /rules\s*:\s*{([^}]*)}/g,
      contentGroupIndex: 1,
    },
    {
      type: "ignores",
      matcher: /ignores\s*:\s*\[([^\]]+)\]/g,
      contentGroupIndex: 1,
    },
    {
      type: "languageOptions",
      matcher: /languageOptions/,
      keySettings: ["parser: tsParser", 'sourceType: "module"', "globals.node"],
    },
  ];

  // Helper to extract values using regex
  const extractValues = (content: string, regex: RegExp, groupIndex = 0): string[] => {
    const results: string[] = [];
    let match;
    const clone = new RegExp(regex.source, regex.flags);

    while ((match = clone.exec(content)) !== null) {
      if (match[groupIndex]) {
        results.push(match[groupIndex].trim());
      }
    }

    return results;
  };

  // Extract string literals from content
  const extractStringLiterals = (content: string): Set<string> => {
    const regex = /["']([^"']+)["']/g;
    const values = extractValues(content, regex, 1).filter(value => !value.includes(":"));

    return new Set(values);
  };

  // Check if an item exists in root config
  const compareConfigs = (item: ConfigItem): string[] => {
    switch (item.type) {
      case "imports":
      case "consts": {
        const templateItems = extractValues(templateContent, item.matcher, item.nameGroupIndex);
        const rootItems = extractValues(rootContent, item.matcher, item.nameGroupIndex);
        return templateItems.filter(ti => !rootItems.some(ri => ri.includes(ti)));
      }

      case "rules":
      case "ignores": {
        const templateBlocks = extractValues(templateContent, item.matcher, item.contentGroupIndex);
        const rootBlocks = extractValues(rootContent, item.matcher, item.contentGroupIndex);

        const templateItems = new Set<string>();
        templateBlocks.forEach(block => {
          extractStringLiterals(block).forEach(value => templateItems.add(value));
        });

        const rootItems = new Set<string>();
        rootBlocks.forEach(block => {
          extractStringLiterals(block).forEach(value => rootItems.add(value));
        });

        return [...templateItems].filter(item => !rootItems.has(item));
      }

      case "languageOptions": {
        const hasLanguageOptions =
          rootContent.includes("languageOptions") && templateContent.includes("languageOptions");

        if (!hasLanguageOptions) {
          return ["languageOptions section missing"];
        }

        return (item.keySettings || []).filter(
          setting => !rootContent.includes(setting) || !templateContent.includes(setting),
        );
      }

      default:
        return [];
    }
  };

  // Load file contents before tests
  beforeAll(async () => {
    rootContent = await fs.readFile(rootConfig, "utf-8");
    templateContent = await fs.readFile(templateConfig, "utf-8");
  });

  // Generate a test for each config item type
  configItems.forEach(item => {
    it(`checks template ${item.type} exist in ${rootConfig}`, () => {
      const missingItems = compareConfigs(item);

      if (missingItems.length > 0) {
        console.error(
          `Template ${item.type} missing in ${rootConfig}:\n` +
            missingItems.map(i => `  - ${i}`).join("\n") +
            "\n" +
            `Template file: ${templateConfig}\n` +
            `Root file: ${rootConfig}`,
        );
      }

      expect(missingItems).toHaveLength(0);
    });
  });
});
