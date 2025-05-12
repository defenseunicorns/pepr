import { execSync } from "child_process";
import { installDevDependency } from "./data-management";
import path from "path";
import fs from "fs";

export function upgradeEslint(repoPath: string): void {
  try {
    installDevDependency(repoPath, "eslint@latest");
    if (fs.existsSync(path.join(repoPath, ".eslintrc.json"))) {
      installDevDependency(repoPath, "typescript-eslint");

      execSync("npx @eslint/migrate-config .eslintrc.json", { cwd: repoPath, stdio: "inherit" });
      installDevDependency(repoPath, "globals");
      installDevDependency(repoPath, "@eslint/js");
      installDevDependency(repoPath, "@eslint/eslintrc");
      console.log("Migrated .eslintrc.json to eslint.config.mjs");
      fs.rmSync(`${repoPath}/.eslintrc.json`);
      replaceLanguageOptions(repoPath);
    }
  } catch (error) {
    console.log(`Failed to upgrade ESLint.`, error);
  }
}
export function createEslintConfig(repoPath: string): void {
  const configPath = path.join(repoPath, "eslint.config.mjs");
  // When testing with rules, use this block
  // installDevDependency(repoPath, '@eslint/js')
  // const eslintConfig = `import eslint from '@eslint/js';

  // export default [
  //   eslint.configs.recommended,
  //   {
  //       files: [
  //           "**/*.ts",
  //           "**/*.cts",
  //           "**.*.mts"
  //       ]
  //   }];`

  //When testing without rules, use this block.
  const eslintConfig = `import tsParser from '@typescript-eslint/parser'

export default [
  {
    languageOptions: {
      parser: tsParser,
    }
  },
  {
    files: [
      "**/*.ts",
      "**/*.cts",
      "**.*.mts"
    ]
  }];
`;

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, eslintConfig, "utf-8");
  }
  console.log(`Created ESLint config.`);
}

export function validateEslint(repoPath: string): string {
  const logFilePath = `${repoPath}/eslint-migration.log`;
  let result = "";
  try {
    result = execSync("npx eslint --version", { cwd: repoPath }).toString().trim();
    fs.writeFileSync(
      logFilePath,
      "This is an automated pull request to configure the project to use eslint. It does not include a ruleset unless the project already contained one.\nStarting migration log.\n",
      { flag: "w" },
    );
    const logFile = fs.openSync(logFilePath, "a");
    execSync(`npx eslint --no-color . >> "${logFilePath}"`, {
      cwd: repoPath,
      stdio: "inherit",
    });
    fs.closeSync(logFile);
    fs.appendFileSync(logFilePath, "End of migration log.\n");
    return result;
  } catch {
    console.log(`Linting reported errors. See ${logFilePath} for details.`);
    fs.appendFileSync(logFilePath, "End of migration log.\n");
    return result;
  }
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function findEslintVersion(dependencies: any): string | null {
  if (!dependencies) return null;

  if (dependencies.eslint && dependencies.eslint.version) {
    return dependencies.eslint.version;
  }

  // Recursively search in nested dependencies
  for (const key of Object.keys(dependencies)) {
    const nestedVersion = findEslintVersion(dependencies[key].dependencies);
    if (nestedVersion) {
      return nestedVersion;
    }
  }

  return null;
}

export function checkEslintInstalled(projectDir: string): string {
  try {
    const stdout = execSync("npm list --json eslint", { cwd: projectDir, encoding: "utf-8" });
    const result = JSON.parse(stdout);

    const eslintVersion = findEslintVersion(result.dependencies);

    if (eslintVersion) {
      console.log(`ESLint is installed: version ${eslintVersion}`);
      return eslintVersion;
    } else {
      console.log("ESLint is NOT installed in this project.");
      return "not-found-1";
    }
  } catch (error) {
    console.log("ESLint was not detected in this project.", error.message);
    return "not-found-2";
  }
}

export function addEslintDependency(repoPath: string): string {
  installDevDependency(repoPath, "eslint@latest");
  installDevDependency(repoPath, "@typescript-eslint/parser");

  return "Install complete";
}
export function replaceLanguageOptions(repoPath: string): void {
  const configFilePath = `${repoPath}/eslint.config.mjs`;
  let configFile = fs.readFileSync(configFilePath, "utf-8");

  const newLanguageOptions = `languageOptions: {
        parser: tsParser,
        parserOptions: {
            projectService: {
                allowDefaultProject: ["eslint.config.mjs"],
            },
            tsconfigRootDir: __dirname,
            sourceType: "module",
        },
    },`;

  // Regular expression to find the existing `languageOptions` section
  const languageOptionsRegex = /languageOptions:\s*\{[^{}]*?(?:\{[^{}]*\}[^{}]*?)*\},/s;

  configFile = configFile.replace(languageOptionsRegex, newLanguageOptions);

  fs.writeFileSync(configFilePath, configFile, "utf-8");
  console.log("Language Options field has been updated.");
}
