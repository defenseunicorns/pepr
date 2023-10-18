// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { CapabilityExport } from "./types";

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

      if (!acc[key]) {
        acc[key] = {
          verbs: ["get", "list"],
          plural: binding.kind.plural || `${binding.kind.kind.toLowerCase()}s`,
        };
      }

      if (binding.isWatch) {
        addVerbIfNotExists(acc[key].verbs, "watch");
      }

      if (binding.event === "CREATEORUPDATE") {
        addVerbIfNotExists(acc[key].verbs, "create");
        addVerbIfNotExists(acc[key].verbs, "update");
      } else {
        addVerbIfNotExists(acc[key].verbs, binding.event.toLowerCase());
      }
    });

    return acc;
  }, {});
};
