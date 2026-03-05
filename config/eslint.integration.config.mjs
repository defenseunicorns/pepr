import tsPlugin from "@typescript-eslint/eslint-plugin";
import path from "node:path";
import js from "@eslint/js";
import globals from "globals";

const tsconfigPath = path.resolve(import.meta.dirname, "./tsconfig.integration.json");

export default [
  {
    ignores: ["integration/testroot", "**/node_modules", "**/dist"],
  },
  js.configs.recommended,
  ...tsPlugin.configs["flat/recommended"],
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: tsconfigPath,
        tsconfigRootDir: path.resolve(import.meta.dirname, "./"),
        sourceType: "module",
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "class-methods-use-this": "error",
      "consistent-this": "error",
      eqeqeq: "error",
      "no-invalid-this": "error",
      "@typescript-eslint/explicit-function-return-type": "error",

      "max-depth": ["error", { max: 3 }],
      "max-nested-callbacks": ["error", { max: 4 }],
      "max-params": ["error", { max: 4 }],
      "max-statements": ["error", { max: 20 }, { ignoreTopLevelFunctions: true }],
      complexity: ["error", { max: 10 }],
    },
  },

  {
    files: ["**/*.test.ts"],
    rules: {
      "max-nested-callbacks": ["error", { max: 8 }],
    },
  },
];
