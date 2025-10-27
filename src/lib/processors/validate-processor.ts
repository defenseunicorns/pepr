// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { kind, KubernetesObject } from "kubernetes-fluent-client";
import { Capability } from "../core/capability";
import { shouldSkipRequest } from "../filter/filter";
import { ValidateResponse } from "../k8s";
import { Binding } from "../types";
import Log from "../telemetry/logger";
import { convertFromBase64Map } from "../utils";
import { PeprValidateRequest } from "../validate-request";
import { ModuleConfig } from "../types";
import { getIgnoreNamespaces } from "../assets/ignoredNamespaces";
import { MeasureWebhookTimeout } from "../telemetry/webhookTimeouts";
import { WebhookType } from "../enums";
import { AdmissionRequest } from "../common-types";

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
        message:
          callbackResp.statusMessage ||
          `Validation failed for ${peprValidateRequest.Request.kind.kind.toLowerCase()}/${peprValidateRequest.Request.name}${peprValidateRequest.Request.namespace ? ` in ${peprValidateRequest.Request.namespace} namespace.` : ""}`,
      };
    }

    // Transfer any warnings from the callback response to the validation response
    if (callbackResp.warnings && callbackResp.warnings.length > 0) {
      valResp.warnings = callbackResp.warnings;
    }

    Log.info(
      actionMetadata,
      `Validation action complete (${label}): ${callbackResp.allowed ? "allowed" : "denied"}`,
    );
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
  const webhookTimer = new MeasureWebhookTimeout(WebhookType.VALIDATE);
  webhookTimer.start(config.webhookTimeout);

  const wrapped = new PeprValidateRequest(req);
  if (req.kind.version === "v1" && req.kind.kind === "Secret") {
    convertFromBase64Map(wrapped.Raw as unknown as kind.Secret);
  }

  Log.info(reqMetadata, `Processing validation request`);

  const responses = (
    await Promise.all(
      capabilities.map(cap => handleCapability(cap, { config, req, reqMetadata, wrapped })),
    )
  ).flat();

  webhookTimer.stop();
  return responses;
}

async function handleCapability(
  capability: Capability,
  context: {
    config: ModuleConfig;
    req: AdmissionRequest;
    reqMetadata: Record<string, string>;
    wrapped: PeprValidateRequest<KubernetesObject>;
  },
): Promise<ValidateResponse[]> {
  const { config, req, reqMetadata, wrapped } = context;
  const { name, bindings, namespaces } = capability;
  const actionMetadata = { ...reqMetadata, name };

  const ignoreNamespaces = getIgnoreNamespaces(config);
  const validBindings = bindings.filter(b => b.validateCallback);

  const results: ValidateResponse[] = [];
  for (const binding of validBindings) {
    const resp = await processBinding(
      { req, namespaces, ignoreNamespaces },
      { binding, actionMetadata, wrapped },
    );
    if (resp) results.push(resp);
  }

  return results;
}

async function processBinding(
  requestCtx: {
    req: AdmissionRequest;
    namespaces: string[] | undefined;
    ignoreNamespaces: string[];
  },
  validationCtx: {
    binding: Binding;
    actionMetadata: Record<string, string>;
    wrapped: PeprValidateRequest<KubernetesObject>;
  },
): Promise<ValidateResponse | null> {
  const { binding, actionMetadata, wrapped } = validationCtx;
  const { req, namespaces, ignoreNamespaces } = requestCtx;

  if (shouldSkipBinding(binding, req, namespaces, ignoreNamespaces)) return null;
  return await processRequest(binding, actionMetadata, wrapped);
}

function shouldSkipBinding(
  binding: Binding,
  req: AdmissionRequest,
  namespaces: string[] | undefined,
  ignoreNamespaces: string[],
): boolean {
  const reason = shouldSkipRequest(binding, req, namespaces ?? [], ignoreNamespaces);
  if (reason !== "") {
    Log.debug(reason);
    return true;
  }
  return false;
}
