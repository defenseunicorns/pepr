// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { kind as k } from "kubernetes-fluent-client";

import { peprStoreGVK } from "../k8s";

export const { group, version, kind } = peprStoreGVK;
export const singular = kind.toLocaleLowerCase();
export const plural = `${singular}s`;
export const name = `${plural}.${group}`;

export const peprStoreCRD: k.CustomResourceDefinition = {
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
