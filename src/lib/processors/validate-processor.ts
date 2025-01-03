// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { kind, KubernetesObject } from "kubernetes-fluent-client";
import { Capability } from "../core/capability";
import { shouldSkipRequest } from "../filter/filter";
import { ValidateResponse } from "../k8s";
import { AdmissionRequest, Binding } from "../types";
import Log from "../telemetry/logger";
import { convertFromBase64Map } from "../utils";
import { PeprValidateRequest } from "../validate-request";
import { ModuleConfig } from "../core/module";
import { resolveIgnoreNamespaces } from "../assets/webhooks";
export async function processRequest(
  binding: Binding,
  actionMetadata: Record<string, string>,
  peprValidateRequest: PeprValidateRequest<KubernetesObject>,
): Promise<ValidateResponse> {
  const label = binding.validateCallback!.name;
  Log.info(actionMetadata, `Processing validation action (${label})`);

  const valResp: ValidateResponse = {
    uid: peprValidateRequest.Request.uid,
    allowed: true, // Assume it's allowed until a validation check fails
  };

  try {
    // Run the validation callback, if it fails set allowed to false
    const callbackResp = await binding.validateCallback!(peprValidateRequest);
    valResp.allowed = callbackResp.allowed;

    // If the validation callback returned a status code or message, set it in the Response
    if (callbackResp.statusCode || callbackResp.statusMessage) {
      valResp.status = {
        code: callbackResp.statusCode || 400,
        message: callbackResp.statusMessage || `Validation failed for ${name}`,
      };
    }

    Log.info(actionMetadata, `Validation action complete (${label}): ${callbackResp.allowed ? "allowed" : "denied"}`);
    return valResp;
  } catch (e) {
    // If any validation throws an error, note the failure in the Response
    Log.error(actionMetadata, `Action failed: ${JSON.stringify(e)}`);
    valResp.allowed = false;
    valResp.status = {
      code: 500,
      message: `Action failed with error: ${JSON.stringify(e)}`,
    };
    return valResp;
  }
}

export async function validateProcessor(
  config: ModuleConfig,
  capabilities: Capability[],
  req: AdmissionRequest,
  reqMetadata: Record<string, string>,
): Promise<ValidateResponse[]> {
  const wrapped = new PeprValidateRequest(req);
  const response: ValidateResponse[] = [];

  // If the resource is a secret, decode the data
  const isSecret = req.kind.version === "v1" && req.kind.kind === "Secret";
  if (isSecret) {
    convertFromBase64Map(wrapped.Raw as unknown as kind.Secret);
  }

  Log.info(reqMetadata, `Processing validation request`);

  for (const { name, bindings, namespaces } of capabilities) {
    const actionMetadata = { ...reqMetadata, name };

    for (const binding of bindings) {
      // Skip this action if it's not a validation action
      if (!binding.validateCallback) {
        continue;
      }

      // Continue to the next action without doing anything if this one should be skipped
      const shouldSkip = shouldSkipRequest(
        binding,
        req,
        namespaces,
        resolveIgnoreNamespaces(config?.alwaysIgnore?.namespaces),
      );
      if (shouldSkip !== "") {
        Log.debug(shouldSkip);
        continue;
      }

      const resp = await processRequest(binding, actionMetadata, wrapped);
      response.push(resp);
    }
  }

  return response;
}
