import { resolve } from "path/posix";
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
import { write } from "./utils";

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
