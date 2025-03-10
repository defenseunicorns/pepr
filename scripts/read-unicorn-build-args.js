// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

const fs = require("fs");
const yaml = require("js-yaml");

try {
  const config = yaml.load(fs.readFileSync("./config/unicorn.yaml", "utf8"));

  const buildImage = config.images?.build;
  const baseImage = config.images?.base;

  if (!buildImage || !baseImage) {
    console.error("Error: Missing 'build' or 'base' image in YAML config.");
    process.exit(1);
  }

  console.log(`--build-arg BUILD_IMAGE=${buildImage} --build-arg BASE_IMAGE=${baseImage}`);
} catch (error) {
  console.error("Error reading or parsing the YAML file:", error);
  process.exit(1);
}
