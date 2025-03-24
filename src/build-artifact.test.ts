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
        .filter(file => !file.endsWith(".d.ts") && !file.endsWith(".d.ts.map"))
        .filter(file => !file.includes("src/templates/"))
        .filter(file => file.endsWith(".ts"));

      for (const tsFile of tsFilesExcludingTemplates) {
        const basePath = tsFile.replace(/\.ts$/, "").replace(/^src/, "dist");
        expectedDeclarationFiles.push(`${basePath}.d.ts`);
        expectedSourceMapFiles.push(`${basePath}.d.ts.map`);
      }
    });

    it("should include declaration (.d.ts) files for each .ts file in dist/", () => {
      const missing = expectedDeclarationFiles.filter(
        declarationFile => !packedFiles.includes(declarationFile),
      );
      expect(missing).toEqual([]);
    });

    it("should include source map (.d.ts.map) files for each .ts file in dist/", () => {
      const missing = expectedSourceMapFiles.filter(
        sourceMapFile => !packedFiles.includes(sourceMapFile),
      );
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
      const message = `[WARNING] Expected file count to be within ${warnThreshold} of the last build, but got difference of ${diff} (this build: ${packedFiles.length}, latest: ${referenceList}).
      If this is intentional, increase the 'warnThreshold' in this unit test.
      This test is a backstop to ensure developers do not accidentaly include unrelated build artifacts.`;
      throw new Error(message);
    }
  });
});
