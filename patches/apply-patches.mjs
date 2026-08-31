import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const patchesDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(patchesDir, "..");
const initCwdPackageJson = process.env.INIT_CWD && join(process.env.INIT_CWD, "package.json");
const hasPatchFiles =
  existsSync(patchesDir) && readdirSync(patchesDir).some(file => file.endsWith(".patch"));

if (!hasPatchFiles) {
  process.exit(0);
}

const installRoot =
  process.env.INIT_CWD && initCwdPackageJson && existsSync(initCwdPackageJson)
    ? process.env.INIT_CWD
    : packageRoot;
const patchDir = relative(installRoot, patchesDir);
const require = createRequire(import.meta.url);
const patchPackage = require.resolve("patch-package/index.js");
const result = spawnSync(process.execPath, [patchPackage, "--patch-dir", patchDir], {
  cwd: installRoot,
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
