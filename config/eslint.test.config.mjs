import tsPlugin from "@typescript-eslint/eslint-plugin";
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["../integration/testroot"],
  },
  js.configs.recommended,
  ...tsPlugin.configs["flat/recommended"],
  {
    files: ["../src/**/*.test.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.test.json",
        tsconfigRootDir: import.meta.dirname,
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
      "max-nested-callbacks": ["error", { max: 8 }],
      "max-params": ["error", { max: 4 }],
      "max-statements": ["error", { max: 20 }, { ignoreTopLevelFunctions: true }],
      complexity: ["error", { max: 10 }],
    },
  },
];
