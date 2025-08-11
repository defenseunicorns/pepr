import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      "**/node_modules",
      "**/dist",
      "**/hack",
      "**/pepr-test-module",
      "**/build.mjs",
      "**/__mocks__",
      "integration/testroot",
      "integration/cli/**/*.test.ts",
      "integration/eslint.config.mjs",
      "eslint.test.config.mjs",
    ],
  },
  ...compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended"),
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: path.resolve(__dirname, "tsconfig.root.json"),
        tsconfigRootDir: path.resolve(__dirname, "../"),
        sourceType: "module",
      },
      globals: {
        ...globals.node,
      },
    },

    rules: {
      "@typescript-eslint/no-floating-promises": "warn",
      "class-methods-use-this": "warn",

      complexity: [
        "warn",
        {
          max: 10,
        },
      ],

      "consistent-this": "warn",
      eqeqeq: "error",

      "max-depth": [
        "warn",
        {
          max: 3,
        },
      ],

      "max-nested-callbacks": [
        "warn",
        {
          max: 4,
        },
      ],

      "max-params": [
        "error",
        {
          max: 4,
        },
      ],

      "max-statements": [
        "warn",
        {
          max: 20,
        },
        {
          ignoreTopLevelFunctions: true,
        },
      ],

      "no-invalid-this": "warn",
    },
  },
  {
    files: ["**/*.test.ts"],

    rules: {
      "max-nested-callbacks": [
        "warn",
        {
          max: 8,
        },
      ],
    },
  },
  {
    files: ["**/*.ts"],
    ignores: ["**/*.test.ts", "./eslint.test.config.mjs", "./eslint.integration.config.mjs"],

    rules: {
      "@typescript-eslint/explicit-function-return-type": "error",
    },
  },
];
