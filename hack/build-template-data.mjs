// This is a helper script to collect the contents of the template files before building the CLI
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.join(__dirname, "..", "src", "templates");

// Read the text file
const gitIgnore = fs.readFileSync(path.join(baseDir, "gitignore"), "utf8");
const readmeMd = fs.readFileSync(path.join(baseDir, "README.md"), "utf8");
const peprTS = fs.readFileSync(path.join(baseDir, "pepr.ts"), "utf8");
const helloPeprTS = fs.readFileSync(path.join(baseDir, "capabilities", "hello-pepr.ts"), "utf8");
const packageJSON = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));

fs.writeFileSync(
  path.join(baseDir, "data.json"),
  JSON.stringify(
    {
      gitIgnore,
      readmeMd,
      peprTS,
      helloPeprTS,
      packageJSON,
    },
    null,
    2,
  ) + "\n",
);
