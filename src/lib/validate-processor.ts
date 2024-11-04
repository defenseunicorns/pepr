// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { kind, KubernetesObject } from "kubernetes-fluent-client";

import { Capability } from "./capability";
import { shouldSkipRequest } from "./filter/shouldSkipRequest";
import { ValidateResponse } from "./k8s";
import { AdmissionRequest, Binding } from "./types";
import Log from "./logger";
import { convertFromBase64Map } from "./utils";
import { PeprValidateRequest } from "./validate-request";
import { ModuleConfig } from "./module";

export async function validateProcessor(
  config: ModuleConfig,
  capabilities: Capability[],
  req: AdmissionRequest,
  reqMetadata: Record<string, string>,
): Promise<ValidateResponse[]> {
  const wrapped = new PeprValidateRequest(req);
  let response: ValidateResponse[] = [];

  // If the resource is a secret, decode the data
  const isSecret = req.kind.version === "v1" && req.kind.kind === "Secret";
  if (isSecret) {
    convertFromBase64Map(wrapped.Raw as unknown as kind.Secret);
  }

  const localWrapped = wrapped;

  Log.info(reqMetadata, `Processing validation request`);

  for (const { name, bindings, namespaces } of capabilities) {
    const actionMetadata = { ...reqMetadata, name };

    response = await Promise.all(
      bindings
        .map(binding => processBinding(response, binding, req, namespaces, config, localWrapped, actionMetadata))
        .filter((promise): promise is Promise<ValidateResponse> => promise !== undefined),
    );
  }

  return response;
}

// eslint-disable-next-line max-statements
const processBinding = async (
  response: ValidateResponse[],
  binding: Binding,
  req: AdmissionRequest,
  namespaces: string[],
  config: ModuleConfig,
  wrapped: PeprValidateRequest<KubernetesObject>,
  actionMetadata: { name: string },
): Promise<ValidateResponse | undefined> => {
  if (binding.validateCallback === undefined) {
    // Skip this action if it's not a validation action
    return undefined;
  }

  if (!binding.validateCallback) {
    return undefined;
  }

  const localResponse: ValidateResponse = {
    uid: req.uid,
    allowed: true, // Assume it's allowed until a validation check fails
  };

  // Continue to the next action without doing anything if this one should be skipped
  const shouldSkip = shouldSkipRequest(binding, req, namespaces, config?.alwaysIgnore?.namespaces);
  if (shouldSkip !== "") {
    Log.debug(shouldSkip);
    return undefined;
  }

  const label = binding.validateCallback.name;
  Log.info(actionMetadata, `Processing validation action (${label})`);

  try {
    // Run the validation callback, if it fails set allowed to false
    const resp = await binding.validateCallback(wrapped);
    localResponse.allowed = resp.allowed;

    // If the validation callback returned a status code or message, set it in the Response
    if (resp.statusCode || resp.statusMessage) {
      localResponse.status = {
        code: resp.statusCode || 400,
        message: resp.statusMessage || `Validation failed for ${name}`,
      };
    }

    Log.info(actionMetadata, `Validation action complete (${label}): ${resp.allowed ? "allowed" : "denied"}`);
  } catch (e) {
    // If any validation throws an error, note the failure in the Response
    Log.error(actionMetadata, `Action failed: ${JSON.stringify(e)}`);
    localResponse.allowed = false;
    localResponse.status = {
      code: 500,
      message: `Action failed with error: ${JSON.stringify(e)}`,
    };
  }
  return localResponse;
};
