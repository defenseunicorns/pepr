// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { kind } from "kubernetes-fluent-client";

import { TLSOut } from "../tls";

export function apiPathSecret(name: string, apiPath: string): kind.Secret {
  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: `${name}-api-path`,
      namespace: "pepr-system",
    },
    type: "Opaque",
    data: {
      value: Buffer.from(apiPath).toString("base64"),
    },
  };
}

export function tlsSecret(name: string, tls: TLSOut): kind.Secret {
  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: `${name}-tls`,
      namespace: "pepr-system",
    },
    type: "kubernetes.io/tls",
    data: {
      "tls.crt": tls.crt,
      "tls.key": tls.key,
    },
  };
}
