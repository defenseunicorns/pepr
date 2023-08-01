// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { V1Secret, V1Service } from "@kubernetes/client-node";
import { TLSOut } from "../k8s/tls";

export function apiTokenSecret(name: string, apiToken: string): V1Secret {
  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: `${name}-api-token`,
      namespace: "pepr-system",
    },
    type: "Opaque",
    data: {
      value: Buffer.from(apiToken).toString("base64"),
    },
  };
}

export function tlsSecret(name: string, tls: TLSOut): V1Secret {
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

export function service(name: string): V1Service {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name,
      namespace: "pepr-system",
    },
    spec: {
      selector: {
        app: name,
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

export function watcherService(name: string): V1Service {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: `${name}-watcher`,
      namespace: "pepr-system",
    },
    spec: {
      selector: {
        app: `${name}-watcher`,
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
