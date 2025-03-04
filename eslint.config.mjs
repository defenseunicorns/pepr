import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: [
        "src/templates",
        "**/node_modules",
        "**/dist",
        "**/hack",
        "**/pepr-test-module",
        "**/build.mjs",
        "**/journey",
        "**/__mocks__",
        "integration/testroot",
    ],
}, ...compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended"), {
    plugins: {
        "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
        parser: tsParser,
        parserOptions: {
            projectService: {
                allowDefaultProject: ["eslint.config.mjs"],
            },
            tsconfigRootDir: __dirname,
            sourceType: "module",
        },
    },

    rules: {
        "@typescript-eslint/no-floating-promises": "warn",
        "class-methods-use-this": "warn",

        complexity: ["warn", {
            max: 10,
        }],

        "consistent-this": "warn",
        eqeqeq: "error",

        "max-depth": ["warn", {
            max: 3,
        }],

        "max-nested-callbacks": ["warn", {
            max: 4,
        }],

        "max-params": ["error", {
            max: 4,
        }],

        "max-statements": ["warn", {
            max: 20,
        }, {
            ignoreTopLevelFunctions: true,
        }],

        "no-invalid-this": "warn",
    },
}, {
    files: ["**/*.test.ts"],

    rules: {
        "max-nested-callbacks": ["warn", {
            max: 8,
        }],
    },
}, {
    files: ["**/*.ts"],
    ignores: ["**/*.test.ts"],

    rules: {
        "@typescript-eslint/explicit-function-return-type": "error",
    },
}];