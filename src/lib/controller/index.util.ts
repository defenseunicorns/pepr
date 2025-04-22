// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AdmissionRequest } from "../common-types";
import { MutateResponse, ValidateResponse } from "../k8s";
import { ResponseItem } from "../types";

export interface KubeAdmissionReview {
  apiVersion: string;
  kind: string;
  response: ValidateResponse[] | MutateResponse | ResponseItem;
}

export function karForMutate(mr: MutateResponse): KubeAdmissionReview {
  return {
    apiVersion: "admission.k8s.io/v1",
    kind: "AdmissionReview",
    response: mr,
  };
}

export function karForValidate(ar: AdmissionRequest, vr: ValidateResponse[]): KubeAdmissionReview {
  const isAllowed = vr.filter(r => !r.allowed).length === 0;

  // Collect all warnings from the ValidateResponse array
  const warnings = vr.reduce<string[]>((acc, curr) => {
    if (curr.warnings && curr.warnings.length > 0) {
      return [...acc, ...curr.warnings];
    }
    return acc;
  }, []);

  const resp: ValidateResponse =
    vr.length === 0
      ? {
          uid: ar.uid,
          allowed: true,
          status: { code: 200, message: "no in-scope validations -- allowed!" },
          warnings: warnings.length > 0 ? warnings : undefined,
        }
      : {
          uid: vr[0].uid,
          allowed: isAllowed,
          status: {
            code: isAllowed ? 200 : 422,
            message: vr
              .filter(rl => !rl.allowed)
              .map(curr => curr.status?.message)
              .join("; "),
          },
          warnings: warnings.length > 0 ? warnings : undefined,
        };
  return {
    apiVersion: "admission.k8s.io/v1",
    kind: "AdmissionReview",
    response: resp,
  };
}
