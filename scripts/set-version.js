// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

/* Required for SLSA Publish of version */

const fs = require("fs");

const packageJSON = require("../package.json");
const packageLockJSON = require("../package-lock.json");

const generateVersion = () => {
  let version = "";
  version = process.env.GITHUB_REF_NAME.split("");
  version = version[0] === "v" ? version.slice(1) : version;
  return version.join("");
};

const packageJSONVersion = (packageJSON, version) => {
  packageJSON.version = version;
  writeToFile("./package.json", packageJSON);
};
const packageLockJSONVersion = (packageLockJSON, version) => {
  packageLockJSON.version = version;
  packageLockJSON.packages[""].version = version;
  writeToFile("./package-lock.json", packageLockJSON);
};

const writeToFile = (file, data) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(file, JSON.stringify(data, null, 2), err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const version = generateVersion();
packageJSONVersion(packageJSON, version);
packageLockJSONVersion(packageLockJSON, version);
