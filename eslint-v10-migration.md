# Migrating Your Pepr Module to ESLint v10

Starting with this release, Pepr upgrades its bundled ESLint from v9 to v10. If you have an existing Pepr module, your `eslint.config.mjs` likely uses a pattern (`FlatCompat`) that ESLint v10 no longer supports. This guide explains what changed, what you'll see, and how to fix it.

---

## Do I Need to Do Anything?

**If you created your module with an older version of Pepr**, yes. Your `eslint.config.mjs` probably starts with:

```js
import { FlatCompat } from "@eslint/eslintrc";
```

This will break after upgrading Pepr. Follow the steps below to migrate.

**If you created your module with this version of Pepr or later**, no. Your module already has the new config format. `pepr format` will work out of the box.

---

## What Changed

ESLint v10 removed support for the legacy configuration system. The `@eslint/eslintrc` package (which provided the `FlatCompat` adapter) is no longer included in ESLint's dependency tree. When you upgrade Pepr, your existing `eslint.config.mjs` will fail to resolve this package.

Additionally, the `globals` and `@eslint/js` packages were previously available to your module as transitive dependencies of ESLint v9. ESLint v10 no longer bundles them. Pepr now provides all of these as peer dependencies so they are automatically installed in your project.

---

## What You'll See

After upgrading Pepr, if your module still has the old config, running `pepr format` will print a deprecation warning:

```text
DEPRECATION: Your eslint.config.mjs uses the FlatCompat adapter from
@eslint/eslintrc, which will be removed in the next release.
Run 'npx pepr update' to migrate to native ESLint flat config.
```

`pepr format` will still work for this release thanks to a temporary compatibility shim. **In the next release, the shim will be removed** and the old config will stop working entirely.

---

## How to Migrate

### Option 1: Automatic migration (recommended)

Run the Pepr update command:

```sh
npx pepr update
```

This will:

- Update Pepr to the latest version
- Automatically detect the legacy `FlatCompat` pattern in your `eslint.config.mjs`
- Replace it with the new native ESLint flat config

After updating, verify it works:

```sh
npx pepr format
```

You should see no deprecation warning.

### Option 2: Manual migration

If you prefer to update your config by hand (for example, if you've added custom rules), replace your `eslint.config.mjs` with:

```js
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import globals from "globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  {
    ignores: ["**/node_modules", "**/dist"],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
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
      globals: {
        ...globals.node,
      },
    },

    rules: {
      ...typescriptEslint.configs.recommended.rules,
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
];
```

If you had custom rules in your old config, add them to the `rules` block above.

---

## What's Different in the New Config

| Old config (FlatCompat) | New config (native) |
| --- | --- |
| Imports `FlatCompat` from `@eslint/eslintrc` | No `@eslint/eslintrc` import |
| Uses `compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended")` | Uses `js.configs.recommended` directly and spreads `typescriptEslint.configs.recommended.rules` |
| No explicit `files` pattern needed | Requires `files: ["**/*.ts"]` — ESLint v10 no longer applies config to `.ts` files by default |
| Requires `@eslint/eslintrc` to be installed | Only needs `@eslint/js`, `globals`, and `@typescript-eslint/*` |

The new config is functionally equivalent — the same lint rules apply. The differences are in how ESLint loads them and that TypeScript files must be explicitly targeted.

---

## Custom ESLint Rules

If you added custom rules to your `eslint.config.mjs` beyond the default template, be aware that:

- **`npx pepr update`** will overwrite your `eslint.config.mjs` if it detects the old `FlatCompat` pattern. Custom rules added on top of the old template will be lost.
- **To preserve custom rules:** either migrate manually (Option 2 above) by copying your custom rules into the new config format, or note your customizations before running `npx pepr update` and re-add them afterward.

If your config does **not** contain `FlatCompat` or `@eslint/eslintrc` (e.g., you already migrated manually), `npx pepr update` will leave it untouched.

---

## Node.js Requirements

The new config uses `fileURLToPath` and `path.dirname` for compatibility with Node.js >= 20.0.0, which is Pepr's minimum supported version. No change to your Node.js version is required.

---

## Timeline

| Release | What happens |
| --- | --- |
| **This release** | Deprecation warning on `pepr format` if old config detected. Old config still works (compatibility shim provided). `npx pepr update` auto-migrates. New modules from `pepr init` use the new config. |
| **Next release** | Compatibility shim removed. Old `FlatCompat` configs will stop working. You must migrate before this release. |

---

## Troubleshooting

### `MODULE_NOT_FOUND: @eslint/eslintrc`

You haven't upgraded Pepr yet, or you're on a version that doesn't include the compatibility shim. Upgrade Pepr first, then migrate:

```sh
npm install pepr@latest
npx pepr update
```

### `pepr format` still shows the deprecation warning after migrating

Check that your `eslint.config.mjs` no longer contains `FlatCompat` or `@eslint/eslintrc`. The warning triggers on the presence of those strings in the file.

### `pepr format` fails after migration with a different error

If you had custom ESLint plugins or configs, they may need their own updates for ESLint v10 compatibility. Check the plugin's documentation for ESLint v10 support.
