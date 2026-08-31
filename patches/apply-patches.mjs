import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const patchesDir = dirname(fileURLToPath(import.meta.url));
const hasPatchFiles =
  existsSync(patchesDir) && readdirSync(patchesDir).some(file => file.endsWith(".patch"));

if (!hasPatchFiles) {
  process.exit(0);
}

const patchPackageBin = join(patchesDir, "..", "node_modules", ".bin", "patch-package");
const result = spawnSync(patchPackageBin, { stdio: "inherit" });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
