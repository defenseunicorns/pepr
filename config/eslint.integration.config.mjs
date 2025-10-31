import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tsconfigPath = path.resolve(__dirname, "./tsconfig.integration.json");

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: ["integration/testroot", "**/node_modules", "**/dist"],
  },

  ...compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended"),

  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: tsconfigPath,
        tsconfigRootDir: path.resolve(__dirname, "./"),
        sourceType: "module",
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
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
