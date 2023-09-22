// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { TLSOut } from "../tls";
import { Secret, Service } from "../k8s/upstream";

export function apiTokenSecret(name: string, apiToken: string): Secret {
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

export function tlsSecret(name: string, tls: TLSOut): Secret {
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

export function service(name: string): Service {
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

export function watcherService(name: string): Service {
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
