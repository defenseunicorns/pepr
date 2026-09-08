// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026-Present The Pepr Authors

import { readFileSync } from "node:fs";

const DEFAULT_DOCKERFILES = ["Dockerfile", "config/Dockerfile"];
const CHAINGUARD_FROM = /^FROM\s+(cgr\.dev\/[^\s]+@sha256:[a-f0-9]{64})\s+AS\s+(\S+)\s*$/gim;

export function chainguardImageRoles(dockerfile: string): Record<string, string> {
  const roles = Object.fromEntries(
    [...dockerfile.matchAll(CHAINGUARD_FROM)].map(match => [match[2], match[1]]),
  );

  if (Object.keys(roles).length !== [...dockerfile.matchAll(CHAINGUARD_FROM)].length) {
    throw new Error("Chainguard image stage aliases must be unique.");
  }

  return Object.fromEntries(
    Object.entries(roles).sort(([first], [second]) => first.localeCompare(second)),
  );
}

export function assertMatchingChainguardImages(first: string, second: string): void {
  const firstImages = chainguardImageRoles(first);
  const secondImages = chainguardImageRoles(second);

  if (Object.keys(firstImages).length === 0 || Object.keys(secondImages).length === 0) {
    throw new Error(
      "Each Dockerfile must contain at least one literal Chainguard FROM image reference.",
    );
  }

  if (JSON.stringify(firstImages) !== JSON.stringify(secondImages)) {
    throw new Error(
      `Chainguard image roles differ:\nDockerfile: ${JSON.stringify(firstImages)}\nconfig/Dockerfile: ${JSON.stringify(secondImages)}`,
    );
  }
}

export function checkDockerfiles(paths: readonly string[] = DEFAULT_DOCKERFILES): void {
  if (paths.length !== 2) {
    throw new Error("Expected exactly two Dockerfile paths.");
  }

  assertMatchingChainguardImages(readFileSync(paths[0], "utf8"), readFileSync(paths[1], "utf8"));
}

if (process.argv[1]?.endsWith("check-chainguard-image-equality.ts")) {
  checkDockerfiles(
    process.argv.slice(2).length === 0 ? DEFAULT_DOCKERFILES : process.argv.slice(2),
  );
}
