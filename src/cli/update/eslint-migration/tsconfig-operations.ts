import fs from "fs";
import path from "path";

export function repoHasTsConfig(repoPath: string): boolean {
  return fs.existsSync(path.join(repoPath, "tsconfig.json"));
}
export function createTSConfig(repoPath: string): void {
  const configPath = path.join(repoPath, "tsconfig.json");
  if (!fs.existsSync(configPath)) {
    fs.copyFileSync("tsconfig.template", configPath);
  }
  console.log(`Created TSconfig from template.`);
}
