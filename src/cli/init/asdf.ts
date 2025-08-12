import { execSync } from "child_process";
import {
  peprPackageJSON,
  gitignore,
  eslint,
  prettier,
  readme,
  tsConfig,
  peprTSTemplate,
  snippet,
  codeSettings,
  samplesYaml,
  helloPepr,
} from "./templates";
import { createDir, write } from "./utils";
import { resolve } from "path";

export async function setupProjectStructure(dirName: string): Promise<void> {
  await createDir(dirName);
  await createDir(resolve(dirName, ".vscode"));
  await createDir(resolve(dirName, "capabilities"));
}

export async function createProjectFiles(
  dirName: string,
  packageJSON: peprPackageJSON,
): Promise<void> {
  const files = [
    { path: gitignore.path, data: gitignore.data },
    { path: eslint.path, data: eslint.data },
    { path: prettier.path, data: prettier.data },
    { path: packageJSON.path, data: packageJSON.data },
    { path: readme.path, data: readme.data },
    { path: tsConfig.path, data: tsConfig.data },
    { path: peprTSTemplate.path, data: peprTSTemplate.data },
  ];

  const nestedFiles = [
    { dir: ".vscode", path: snippet.path, data: snippet.data },
    { dir: ".vscode", path: codeSettings.path, data: codeSettings.data },
    { dir: "capabilities", path: samplesYaml.path, data: samplesYaml.data },
    { dir: "capabilities", path: helloPepr.path, data: helloPepr.data },
  ];

  for (const file of files) {
    await write(resolve(dirName, file.path), file.data);
  }

  for (const file of nestedFiles) {
    await write(resolve(dirName, file.dir, file.path), file.data);
  }
}

export const doPostInitActions = (dirName: string): void => {
  // run npm install from the new directory
  process.chdir(dirName);
  execSync("npm install", {
    stdio: "inherit",
  });

  // setup git
  execSync("git init --initial-branch=main", {
    stdio: "inherit",
  });

  // try to open vscode
  try {
    execSync("code .", {
      stdio: "inherit",
    });
  } catch {
    console.warn("VSCode was not found, IDE will not automatically open.");
  }
};
