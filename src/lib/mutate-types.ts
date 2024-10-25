// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { GroupVersionKind, KubernetesObject } from "kubernetes-fluent-client";

// Basic operation type for mutation operations
export enum Operation {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  CONNECT = "CONNECT",
}

// AdmissionRequest interface for handling admission requests in the mutation context
export interface AdmissionRequest<T = KubernetesObject> {
  readonly uid: string;
  readonly kind: GroupVersionKind;
  readonly resource: GroupVersionResource;
  readonly subResource?: string;
  readonly requestKind?: GroupVersionKind;
  readonly requestResource?: GroupVersionResource;
  readonly requestSubResource?: string;
  readonly name: string;
  readonly namespace?: string;
  readonly operation: Operation;
  readonly userInfo: {
    username?: string;
    uid?: string;
    groups?: string[];
    extra?: { [key: string]: string[] };
  };
  readonly object: T;
  readonly oldObject?: T;
  readonly dryRun?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly options?: any;
}

// DeepPartial utility type for deep optional properties
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// GroupVersionResource interface for resource identification
export interface GroupVersionResource {
  readonly group: string;
  readonly version: string;
  readonly resource: string;
}
