// Helper for using a KFC release candidate in Pepr
const { exec } = require("child_process");
const fs = require("fs");
const p = require("path");
const { Command } = require("commander");

const program = new Command();
const repoUrl = `https://github.com/defenseunicorns/kubernetes-fluent-client.git`;
const moreInfo = "\n\nUse node hack/kfc-dev.js --help for more information.";

// Helper function to run shell commands
const runCmd = (cmd, dir) => {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: dir }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        reject(error);
        process.exit(1);
        return;
      }
      if (stderr) {
        console.log(stderr);
      }
      console.log(stdout);
      resolve();
    });
  });
};

const runSequence = async (...commands) => {
  try {
    for (const { cmd, dir } of commands) {
      await runCmd(cmd, dir);
    }
    console.log("All commands executed successfully.");
  } catch (error) {
    console.error("An error occurred during command execution:", error);
  }
};

// Command Definitions
program
  .name("kfc-dev")
  .description("Helper for using a KFC release candidate in Pepr.")
  .version("0.0.1");

// Build Command
program
  .command("build")
  .description("Builds a dev image from a repo or local path")
  .option("-r, --repo <branch>", "Specify the branch to clone and build from the repo")
  .option("-l, --local <path>", "Specify the local path to build from")
  .action(async options => {
    let currentDir = process.cwd();

    // Clone from the repo
    if (options.repo) {
      const clone = { cmd: `git clone -b ${options.repo} ${repoUrl}`, dir: currentDir };
      const install = { cmd: `npm install`, dir: "kubernetes-fluent-client" };
      const build = { cmd: `npm run build`, dir: "kubernetes-fluent-client" };
      const image = {
        cmd: `docker buildx build --output type=docker --tag pepr:dev . -f Dockerfile.kfc`,
        dir: currentDir,
      };
      await runSequence(clone, install, build, image);
    }

    // Build from local path
    if (options.local) {
      const sourcePath = p.join(__dirname, options.local);
      const dirPath = p.join(__dirname, "../kubernetes-fluent-client");
      fs.mkdirSync(dirPath, { recursive: true });
      fs.cpSync(sourcePath, dirPath, { recursive: true, overwrite: true });

      const install = { cmd: `npm install`, dir: "kubernetes-fluent-client" };
      const build = { cmd: `npm run build`, dir: "kubernetes-fluent-client" };
      const image = {
        cmd: `docker buildx build --output type=docker --tag pepr:dev . -f Dockerfile.kfc`,
        dir: currentDir,
      };
      await runSequence(install, build, image);
    }
  });

// Import Command
program
  .command("import")
  .description("Imports Kubernetes Fluent Client source into node_modules for pepr-test-module")
  .option("-l, --local <path>", "Specify the local path to import from")
  .action(async options => {
    if (!options.local) {
      console.error(`Error: Please provide a path for the import operation. ${moreInfo}`);
      process.exit(1);
    }

    const sourcePathSrc = p.join(__dirname, `${options.local}/src`);
    const sourcePathDist = p.join(__dirname, `${options.local}/dist`);

    const dirTestModulePathSrc = p.join(
      __dirname,
      "../pepr-test-module/node_modules/kubernetes-fluent-client/src",
    );

    await runSequence({ cmd: `npm run build`, dir: "kubernetes-fluent-client" });

    const dirLocalModulePathSrc = p.join(__dirname, "../node_modules/kubernetes-fluent-client/src");
    const dirLocalModulePathDist = p.join(
      __dirname,
      "../node_modules/kubernetes-fluent-client/dist",
    );

    fs.cpSync(sourcePathSrc, dirTestModulePathSrc, { recursive: true, overwrite: true });
    fs.cpSync(sourcePathSrc, dirLocalModulePathSrc, { recursive: true, overwrite: true });
    fs.cpSync(sourcePathDist, dirLocalModulePathDist, { recursive: true, overwrite: true });

    console.log("Kubernetes Fluent Client source imported successfully.");
  });

program.parse(process.argv);
