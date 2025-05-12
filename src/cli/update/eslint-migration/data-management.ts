import { execSync } from "child_process";
import * as path from "path";
import fs from "fs";

export function parseRepoPaths(filePath: string): string[] {
  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const jsonData: string[] = JSON.parse(fileContent);

    if (Array.isArray(jsonData)) {
      return jsonData;
    } else {
      throw new Error("Unexpected JSON structure: Expected an array of strings.");
    }
  } catch (error) {
    console.error("Error reading or parsing the file:", error);
    return [];
  }
}

export function installDevDependency(repoPath: string, dependency: string): void {
  execSync(`npm install --save-dev ${dependency}`, { cwd: repoPath, stdio: "ignore" });
  console.log(`Installed ${dependency} as a devDependency.`);
}

export function findPackageJson(dir: string): string {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);

    if (file.isFile() && file.name === "package.json") {
      console.log(`Found package.json at: ${fullPath}`);
      return fullPath; // Return the first found package.json
    } else if (file.isDirectory() && file.name !== "node_modules") {
      const found = findPackageJson(fullPath);
      if (found) return found;
    }
  }

  return "";
}
