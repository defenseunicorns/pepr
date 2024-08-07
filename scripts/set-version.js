// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

/* Required for SLSA Publish of version */

const fs = require("fs");

const packageJSON = require("../package.json")
const packageLockJSON = require("../package-lock.json")

const version = process.env.GITHUB_REF_NAME;

const packageJSONVersion = (packageJSON) => {
    packageJSON.version = version;
    writeToFile("./package.json", packageJSON);
}
const packageLockJSONVersion = (packageLockJSON) => {
    packageLockJSON.version = version;
    packageLockJSON.packages[""].version = version;
    writeToFile("./package-lock.json", packageLockJSON);
}

const writeToFile = (file, data) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(file, JSON.stringify(data, null, 2), (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    })
}


packageJSONVersion(packageJSON);
packageLockJSONVersion(packageLockJSON);
