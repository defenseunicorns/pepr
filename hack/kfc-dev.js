// Helper for using a KFC release candidate in Pepr
const { exec } = require("child_process");
const fs = require("fs");
const p = require("path");

const command = process.argv[2];
const flag = process.argv[3];
const path = process.argv[4];

const moreInfo = "\n\nUse node hack/kfc-dev.js for more information.";

const usage = `
Helper for using a KFC release candidate in Pepr. 

Usage:
  node hack/kfc-dev.js [command]

Available Commands:
  build       Builds a dev image from a repo or local path
  import      Imports Kubernetes Fluent Client source into node_modules for pepr-test-module

Flags:
  -r, --repo string string  repo and branch to clone from
  -l, --local string        path of KFC source code

Examples: 
  # Build dev image from remote repo
  > node hack/kfc-dev.js build -r <branch>
  > node hack/kfc-dev.js build -r undici-fetch

  # Build dev image from local source
  > node hack/kfc-dev.js build -l <path>
  > node hack/kfc-dev.js build -l ./../../../kubernetes-fluent-client

  # Import KFC source code into node_modules
  > node hack/kfc-dev.js import -l <path>
  > node hack/kfc-dev.js import -l ./../../../kubernetes-fluent-client

`;

/** Warnings are basic - not inteded to cover each case  */

if (!command) {
  console.log(usage);
  process.exit(1);
}

if (!flag) {
  console.error(`Error: Please provide a flag. Example: -r or -l. ${moreInfo}`);
  process.exit(1);
}

if (!path) {
  console.error(`Error: Please provide a path. ${moreInfo}`);
  process.exit(1);
}

if (command === "build" && flag === "-r" && !path) {
  console.error(`Error: Please provide a branch. ${moreInfo}`);
  process.exit(1);
}

if (command === "build" && flag === "-l" && !path) {
  console.error(`Error: Please provide a path. ${moreInfo}`);
  process.exit(1);
}

if (command === "import" && flag === "-l" && !path) {
  console.error(`Error: Please provide a path. ${moreInfo}`);
  process.exit(1);
}

if (command === "import" && flag === "-r") {
  console.error(`Error: Import only supports local path. ${moreInfo}`);
  process.exit(1);
}

// Scaffolding
const repoUrl = `https://github.com/defenseunicorns/kubernetes-fluent-client.git`;
let currentDir = process.cwd();

// Commands
const clone = { cmd: `git clone -b ${path} ${repoUrl}`, dir: currentDir };
const install = { cmd: `npm install`, dir: "kubernetes-fluent-client" };
const buildKFC = { cmd: `npm run build`, dir: "kubernetes-fluent-client" };
const buildPepr = { cmd: `npm run build`, dir: currentDir };
const image = {
  cmd: `docker buildx build --output type=docker --tag pepr:dev . -f Dockerfile.kfc`,
  dir: currentDir,
};

// Actions
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

// Build dev image from repo
if (command === "build" && flag === "-r" && path) {
  runSequence(clone, install, buildKFC, image);
  // prepare for build and pack
  sourcePathSrc = p.join(__dirname, `../kubernetes-fluent-client/src`);
  sourcePathDist = p.join(__dirname, `../kubernetes-fluent-client/dist`);
  dirLocalModulePathSrc = p.join(__dirname, "../node_modules/kubernetes-fluent-client/src");
  dirLocalModulePathDist = p.join(__dirname, "../node_modules/kubernetes-fluent-client/dist");
  fs.cpSync(sourcePathSrc, dirLocalModulePathSrc, { recursive: true, overwrite: true });
  fs.cpSync(sourcePathDist, dirLocalModulePathDist, { recursive: true, overwrite: true });
}

// Build dev image from local source
if (command === "build" && flag === "-l" && path) {
  sourcePath = p.join(__dirname, path);
  dirPath = p.join(__dirname, "../kubernetes-fluent-client");
  fs.mkdirSync(dirPath, { recursive: true });
  fs.cpSync(sourcePath, dirPath, { recursive: true, overwrite: true });
  runSequence(install, buildKFC, image);
}

// Import KFC source code into node_modules
if (command === "import" && flag === "-l" && path) {
  sourcePathSrc = p.join(__dirname, `${path}/src`);
  sourcePathDist = p.join(__dirname, `${path}/dist`);
  dirTestModulePathSrc = p.join(
    __dirname,
    "../pepr-test-module/node_modules/kubernetes-fluent-client/src",
  );
  dirTestModulePathDist = p.join(
    __dirname,
    "../pepr-test-module/node_modules/kubernetes-fluent-client/dist",
  );
  dirLocalModulePathSrc = p.join(__dirname, "../node_modules/kubernetes-fluent-client/src");
  dirLocalModulePathDist = p.join(__dirname, "../node_modules/kubernetes-fluent-client/dist");
  fs.cpSync(sourcePathSrc, dirTestModulePathSrc, { recursive: true, overwrite: true });
  fs.cpSync(sourcePathDist, dirTestModulePathDist, { recursive: true, overwrite: true });
  fs.cpSync(sourcePathSrc, dirLocalModulePathSrc, { recursive: true, overwrite: true });
  fs.cpSync(sourcePathDist, dirLocalModulePathDist, { recursive: true, overwrite: true });
}
