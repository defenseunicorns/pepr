import tsPlugin from "@typescript-eslint/eslint-plugin";
import path from "node:path";
import js from "@eslint/js";
import globals from "globals";

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
  js.configs.recommended,
  ...tsPlugin.configs["flat/recommended"],
  {
    languageOptions: {
      parserOptions: {
        project: path.resolve(import.meta.dirname, "tsconfig.root.json"),
        tsconfigRootDir: path.resolve(import.meta.dirname, "../"),
        sourceType: "module",
      },
      globals: {
        ...globals.node,
      },
    },

    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "class-methods-use-this": "error",

      complexity: [
        "error",
        {
          max: 10,
        },
      ],

      "consistent-this": "error",
      eqeqeq: "error",

      "max-depth": [
        "error",
        {
          max: 3,
        },
      ],

      "max-nested-callbacks": [
        "error",
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
        "error",
        {
          max: 20,
        },
        {
          ignoreTopLevelFunctions: true,
        },
      ],

      "no-invalid-this": "error",
    },
  },
  {
    files: ["**/*.test.ts"],

    rules: {
      "max-nested-callbacks": [
        "error",
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
