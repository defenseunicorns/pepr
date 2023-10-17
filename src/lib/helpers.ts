// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { CapabilityExport } from "./types";

type RBACMap = {
  [key: string]: {
    verbs: string[];
    plural: string;
  };
};

export const createRBACMap = (capabilities: CapabilityExport[]): RBACMap => {
  return capabilities.reduce((acc: RBACMap, capability: CapabilityExport) => {
    capability.bindings.forEach(binding => {
      // Create a unique key for the rule
      const key = `${binding.kind.group}/${binding.kind.version}/${binding.kind.kind}`;

      if (!acc[key]) {
        acc[key] = {
          verbs: ["get", "list"],
          plural: binding.kind.plural || `${binding.kind.kind.toLowerCase()}s`,
        };
      }
      if (binding.isWatch === true) {
        if (!acc[key].verbs.includes("watch")) {
          acc[key].verbs.push("watch");
        }
      }
      if (binding.event === "CREATEORUPDATE") {
        if (!acc[key].verbs.includes("create")) {
          acc[key].verbs.push("create");
        }
        if (!acc[key].verbs.includes("update")) {
          acc[key].verbs.push("update");
        }
      } else {
        if (!acc[key].verbs.includes(binding.event.toLowerCase())) {
          acc[key].verbs.push(binding.event.toLowerCase());
        }
      }
    });
    return acc;
  }, {});
};
