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

  // TODO: Size check

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
});
// TODO: Ensure files have a corresponding declaration file
