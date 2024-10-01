// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors

import * as fs from "fs";

export interface FileSystem {
  readFile(filePath: string): string;
  writeFile(filePath: string, content: string): void;
  readdirSync(directory: string): string[];
}

/* eslint class-methods-use-this: "off" */
export class NodeFileSystem implements FileSystem {
  readFile(filePath: string): string {
    return fs.readFileSync(filePath, "utf8");
  }

  writeFile(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content, "utf8");
  }

  readdirSync(directory: string): string[] {
    return fs.readdirSync(directory);
  }
}
