// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { CapabilityExport } from "./types";
import { promises as fs } from "fs";

type RBACMap = {
  [key: string]: {
    verbs: string[];
    plural: string;
  };
};

export const addVerbIfNotExists = (verbs: string[], verb: string) => {
  if (!verbs.includes(verb)) {
    verbs.push(verb);
  }
};

export const createRBACMap = (capabilities: CapabilityExport[]): RBACMap => {
  return capabilities.reduce((acc: RBACMap, capability: CapabilityExport) => {
    capability.bindings.forEach(binding => {
      const key = `${binding.kind.group}/${binding.kind.version}/${binding.kind.kind}`;

      acc["pepr.dev/v1/peprstore"] = {
        verbs: ["create", "get", "patch", "watch"],
        plural: "peprstores",
      };

      if (!acc[key] && binding.isWatch) {
        acc[key] = {
          verbs: ["watch"],
          plural: binding.kind.plural || `${binding.kind.kind.toLowerCase()}s`,
        };
      }
    });

    return acc;
  }, {});
};

export async function createDirectoryIfNotExists(path: string) {
  try {
    await fs.access(path);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.mkdir(path, { recursive: true });
    } else {
      throw error;
    }
  }
}
