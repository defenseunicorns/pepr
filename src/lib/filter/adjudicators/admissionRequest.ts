// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Operation } from "../../enums";
import { AdmissionRequest } from "../../types";
import { defaultTo, pipe } from "ramda";
import { KubernetesObject } from "kubernetes-fluent-client";

export const declaredOperation = pipe(
  (request: AdmissionRequest<KubernetesObject>): Operation => request?.operation,
  defaultTo(""),
);
export const declaredGroup = pipe(
  (request: AdmissionRequest<KubernetesObject>): string => request?.kind?.group,
  defaultTo(""),
);
export const declaredVersion = pipe(
  (request: AdmissionRequest<KubernetesObject>): string | undefined => request?.kind?.version,
  defaultTo(""),
);
export const declaredKind = pipe(
  (request: AdmissionRequest<KubernetesObject>): string => request?.kind?.kind,
  defaultTo(""),
);
export const declaredUid = pipe((request: AdmissionRequest<KubernetesObject>): string => request?.uid, defaultTo(""));
