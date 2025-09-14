// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, afterAll,afterEach, describe, it, expect } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MARKDOWN_FILE = path.resolve(
  process.cwd(),
  "docs/040_pepr-tutorials/030_create-pepr-operator.md",
);

function extractCommandBlocks(markdown: string): string[] {
  const regex = /<!-- Start Block -->([\s\S]*?)<!-- End Block -->/g;
  const blocks: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    const code = match[1]
      .trim()
      .replace(/^```bash\s*/gm, "")
      .replace(/```$/gm, "")
      .trim();

    if (code) {
      blocks.push(code);
    }
  }

  return blocks;
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pepr-operator-"));
const originalCwd = process.cwd();

beforeAll(() => {
  execSync(
    "k3d cluster delete operator-tutorial || true; " +
      "k3d cluster create operator-tutorial --k3s-arg '--debug@server:0' --wait; " +
      "kubectl rollout status deployment -n kube-system",
    { stdio: "inherit", shell: "/bin/bash" }
  );
}, 10 * 60 * 1000);

afterEach(async () => {
  await new Promise(res => setImmediate(res))
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("Pepr Operator Tutorial", { timeout: 1000 * 5 * 60 }, () => {
  const markdown = fs.readFileSync(MARKDOWN_FILE, "utf-8");
  const commands = extractCommandBlocks(markdown);

  process.chdir(tmpDir);

  commands.forEach((command, i) => {
    it(`runs command step ${i + 1}`, () => {
      const workingDir = i === 0 ? tmpDir : path.join(tmpDir, "operator");

      console.log(`\n[Command ${i + 1}/${commands.length}]`);
      console.log(`Working Dir: ${workingDir}`);
      console.log(`Running command:\n${command}\n`);
      
      const result = spawnSync(command, {
        cwd: workingDir,
        encoding: "utf-8",
        shell: "/bin/bash",
      });

      if (result.stdout) console.log(result.stdout);
      if (result.stderr) console.error(result.stderr);
      
      expect(result.status).toBe(0);
    }, 60 * 60 * 1000,);
  });
});
