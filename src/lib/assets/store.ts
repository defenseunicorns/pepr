// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { PeprStore, modelToGroupVersionKind } from "../k8s";
import { CustomResourceDefinition } from "../k8s/upstream";

export const { group, version, kind } = modelToGroupVersionKind(PeprStore.name);
export const singular = kind.toLocaleLowerCase();
export const plural = `${singular}s`;
export const name = `${singular}.${group}`;

export function peprStoreCRD(): CustomResourceDefinition {
  return {
    apiVersion: "apiextensions.k8s.io/v1",
    kind: "CustomResourceDefinition",
    metadata: {
      name,
    },
    spec: {
      group,
      versions: [
        {
          // typescript doesn't know this is really already set, which is kind of annoying
          name: version || "v1",
          served: true,
          storage: true,
          schema: {
            openAPIV3Schema: {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  additionalProperties: {
                    type: "string",
                  },
                },
              },
            },
          },
        },
      ],
      scope: "Namespaced",
      names: {
        plural,
        singular,
        kind,
      },
    },
  };
}
