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

export function service(name: string): kind.Service {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name,
      namespace: "pepr-system",
      labels: {
        "pepr.dev/controller": "admission",
      },
    },
    spec: {
      selector: {
        app: name,
        "pepr.dev/controller": "admission",
      },
      ports: [
        {
          port: 443,
          targetPort: 3000,
        },
      ],
    },
  };
}

export function watcherService(name: string): kind.Service {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: `${name}-watcher`,
      namespace: "pepr-system",
      labels: {
        "pepr.dev/controller": "watcher",
      },
    },
    spec: {
      selector: {
        app: `${name}-watcher`,
        "pepr.dev/controller": "watcher",
      },
      ports: [
        {
          port: 443,
          targetPort: 3000,
        },
      ],
    },
  };
}
