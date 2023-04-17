// This is a helper script to collect the contents of the template files before building the CLI

/* eslint-disable */
const fs = require("fs");
const path = require("path");

const baseDir = path.join(__dirname, "..", "src", "cli", "init", "templates");

// Read the text file
const gitignore = fs.readFileSync(path.join(baseDir, "gitignore"), "utf8");
const readme = fs.readFileSync(path.join(baseDir, "README.md"), "utf8");
const peprTS = fs.readFileSync(path.join(baseDir, "pepr.ts"), "utf8");
const helloPeprTS = fs.readFileSync(path.join(baseDir, "capabilities", "hello-pepr.ts"), "utf8");

fs.writeFileSync(
  path.join(baseDir, "data.json"),
  JSON.stringify({
    gitignore,
    readme,
    peprTS,
    helloPeprTS,
  })
);
