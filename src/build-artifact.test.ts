import { describe, beforeAll, it, expect } from "@jest/globals";
import { execSync } from "child_process";

describe("Published package does not include unintended files", () => {
  let packedFiles: string[] = [];

  beforeAll(async () => {
    type BuildArtifact = { mode: number; path: string; size: number };
    const tarballBuffer = execSync("npm pack --dry-run --json", { stdio: "pipe" });
    const tarballJson = JSON.parse(tarballBuffer.toString());
    packedFiles = tarballJson.flatMap((entry: { files: BuildArtifact[] }) =>
      entry.files.map((f: { path: string }) => f.path),
    );
  });

  it("should not include files outside known paths", () => {
    const allowedPrefixes = ["src/", "dist/", "LICENSE", "README.md", "package.json"];
    const disallowed = packedFiles.filter(file => {
      return !allowedPrefixes.some(prefix => file.startsWith(prefix));
    });
    expect(disallowed).toEqual([]);
  });

  describe("when creating declaration files", () => {
    const expectedDeclarationFiles: string[] = [];
    const expectedSourceMapFiles: string[] = [];
    beforeAll(() => {
      const tsFilesExcludingTemplates = packedFiles
        .filter(f => f.endsWith(".ts") && !f.endsWith(".d.ts") && !f.endsWith(".d.ts.map"))
        .filter(f => !f.includes("src/templates/"))
        .map(f => f.replace(/\.ts$/, "").replace(/^src/, "dist"));

      for (const tsFile of tsFilesExcludingTemplates) {
        expectedDeclarationFiles.push(`${tsFile}.d.ts`);
        expectedSourceMapFiles.push(`${tsFile}.d.ts.map`);
      }
    });

    it.each([
      ["declaration (.d.ts)", expectedDeclarationFiles],
      ["source map (.d.ts.map)", expectedSourceMapFiles],
    ])("should include %s files for each .ts file in dist/", (_, expectedFiles) => {
      const missing = expectedFiles.filter(file => !packedFiles.includes(file));
      expect(missing).toEqual([]);
    });
  });

  it("should warn the developer when lots of files are added to the build", async () => {
    async function getPublishedFileCount(pkg: string): Promise<number> {
      const response = await fetch(`https://registry.npmjs.org/${pkg}/latest`);
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata for package "${pkg}"`);
      }
      const metadata = await response.json();
      return metadata.dist.fileCount;
    }

    const referenceList = await getPublishedFileCount("pepr");
    const diff = Math.abs(packedFiles.length - referenceList);
    const warnThreshold = 15;
    if (diff > warnThreshold) {
      const message = `[WARN] Expected file count to be within ${warnThreshold} of the last build, but got difference of ${diff} (this build: ${packedFiles.length}, latest: ${referenceList}).
      If this is intentional, increase the 'warnThreshold' in this unit test.
      This test is a backstop to ensure developers do not accidentaly include unrelated build artifacts.`;
      throw new Error(message);
    }
  });
});
