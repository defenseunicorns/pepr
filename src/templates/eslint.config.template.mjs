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
      "node_modules",
      "dist",
    ]
  },
  {
    languageOptions: {
      globals: globals.es2022,
      parser: tsesparser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.mjs'],
        },
        ecmaVersion: 2022,
      }
    }
  },
  ...tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
      rules: {
        "@typescript-eslint/no-floating-promises": "error",
      }
    }
  ),
  {
    rules: {}
  },
];
