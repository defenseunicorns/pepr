import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import tsesparser from "@typescript-eslint/parser";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: [
      "**/*.{js,mjs,cjs,ts}"
    ]
  },
  {
    ignores: [
      "src/templates",
      "node_modules",
      "dist",
      "hack",
      "pepr-test-module",
      "build.mjs",
      "journey",
      "__mocks__",
    ]
  },
  {
    languageOptions: {
      globals: globals.es2022,
      parser: tsesparser,
      parserOptions: {
        projectService: true,
        ecmaVersion: 2022,
      }
    }
  },
  ...tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
      rules: {
        "@typescript-eslint/no-floating-promises": "warn",

        "@typescript-eslint/no-unused-expressions": [ "warn" ],
        "@typescript-eslint/no-unused-vars": "warn",
      }
    }
  ),
  {
    rules: {
      "class-methods-use-this": "warn",
      "complexity": ["warn", { "max": 10 }],
      "consistent-this": "warn",
      "eqeqeq": "error",
      "max-depth": ["warn", { "max": 3 }],
      "max-nested-callbacks": ["warn", { "max": 4 }],
      "max-params": ["warn", { "max": 4 }],
      "max-statements": ["warn", { "max": 20 }, { "ignoreTopLevelFunctions": true }],
      "no-invalid-this": "warn"
    }
  },
];