// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import jsonPatch from "fast-json-patch";
import { KubernetesObject } from "kubernetes-fluent-client";
import { MeasureWebhookTimeout } from "../telemetry/webhookTimeouts";
import { Capability } from "../core/capability";
import { shouldSkipRequest } from "../filter/filter";
import { MutateResponse } from "../k8s";
import { Binding } from "../types";
import Log from "../telemetry/logger";
import { ModuleConfig } from "../types";
import { PeprMutateRequest } from "../mutate-request";
import { base64Encode } from "../utils";
import { OnError } from "../../cli/init/enums";
import { resolveIgnoreNamespaces } from "../assets/webhooks";
import { Operation } from "fast-json-patch";
import { WebhookType } from "../enums";

import { AdmissionRequest } from "../common-types";

import { decodeData, reencodeData } from "./decode-utils";

export interface Bindable {
  req: AdmissionRequest;
  config: ModuleConfig;
  name: string;
  namespaces: string[];
  binding: Binding;
  actMeta: Record<string, string>;
}

export interface Result {
  wrapped: PeprMutateRequest<KubernetesObject>;
  response: MutateResponse;
}

// Add annotations to the request to indicate that the capability started processing
// this will allow tracking of failed mutations that were permitted to continue
export function updateStatus(
  config: ModuleConfig,
  name: string,
  wrapped: PeprMutateRequest<KubernetesObject>,
  status: string,
): PeprMutateRequest<KubernetesObject> {
  // Only update the status if the request is a CREATE or UPDATE (we don't use CONNECT)
  if (wrapped.Request.operation === "DELETE") {
    return wrapped;
  }
  wrapped.SetAnnotation(`${config.uuid}.pepr.dev/${name}`, status);

  return wrapped;
}

export function logMutateErrorMessage(e: Error): string {
  try {
    if (e.message && e.message !== "[object Object]") {
      return e.message;
    } else {
      throw new Error("An error occurred in the mutate action.");
    }
  } catch {
    return "An error occurred with the mutate action.";
  }
}

export async function processRequest(
  bindable: Bindable,
  wrapped: PeprMutateRequest<KubernetesObject>,
  response: MutateResponse,
): Promise<Result> {
  const { binding, actMeta, name, config } = bindable;

  const label = binding.mutateCallback!.name;
  Log.info(actMeta, `Processing mutation action (${label})`);

  wrapped = updateStatus(config, name, wrapped, "started");

  try {
    // Run the action
    await binding.mutateCallback!(wrapped);

    // Log on success
    Log.info(actMeta, `Mutation action succeeded (${label})`);

    // Add annotations to the request to indicate that the capability succeeded
    wrapped = updateStatus(config, name, wrapped, "succeeded");
  } catch (e) {
    wrapped = updateStatus(config, name, wrapped, "warning");
    response.warnings = response.warnings || [];

    const errorMessage = logMutateErrorMessage(e);

    // Log on failure
    Log.error(actMeta, `Action failed: ${errorMessage}`);
    response.warnings.push(`Action failed: ${errorMessage}`);

    switch (config.onError) {
      case OnError.REJECT:
        response.result = "Pepr module configured to reject on error";
        break;

      case OnError.AUDIT:
        response.auditAnnotations = response.auditAnnotations || {};
        response.auditAnnotations[Date.now()] = `Action failed: ${errorMessage}`;
        break;
    }
  }

  return { wrapped, response };
}

/* eslint max-statements: ["warn", 25] */
export async function mutateProcessor(
  config: ModuleConfig,
  capabilities: Capability[],
  req: AdmissionRequest,
  reqMetadata: Record<string, string>,
): Promise<MutateResponse> {
  const webhookTimer = new MeasureWebhookTimeout(WebhookType.MUTATE);
  webhookTimer.start(config.webhookTimeout);
  let response: MutateResponse = {
    uid: req.uid,
    warnings: [],
    allowed: false,
  };

  const decoded = decodeData(new PeprMutateRequest(req));
  let wrapped = decoded.wrapped;

  Log.info(reqMetadata, `Processing request`);
  const bindables: Bindable[] = capabilities.flatMap(capa =>
    capa.bindings.flatMap(bind => {
      if (!bind.mutateCallback) {
        return [];
      }

      const shouldSkip = shouldSkipRequest(
        bind,
        req,
        capa.namespaces,
        resolveIgnoreNamespaces(config.alwaysIgnore?.namespaces),
      );

      if (shouldSkip !== "") {
        Log.debug(shouldSkip);
        return [];
      }

      return [
        {
          req,
          config,
          name: capa.name,
          namespaces: capa.namespaces,
          binding: bind,
          actMeta: { ...reqMetadata, name: capa.name },
        },
      ];
    }),
  );

  for (const bindable of bindables) {
    ({ wrapped, response } = await processRequest(bindable, wrapped, response));
    if (config.onError === OnError.REJECT && response?.warnings!.length > 0) {
      webhookTimer.stop();
      return response;
    }
  }

  // If no capability matched the request, exit early
  if (bindables.length === 0) {
    Log.info(reqMetadata, `No matching actions found`);
    webhookTimer.stop();
    return { ...response, allowed: true };
  }

  // delete operations can't be mutate, just return before the transformation
  if (req.operation === "DELETE") {
    webhookTimer.stop();
    return { ...response, allowed: true };
  }

  // unskip base64-encoded data fields that were skipDecode'd
  const transformed = reencodeData(wrapped, decoded.skipped);

  // Compare the original request to the modified request to get the patches
  const patches = jsonPatch.compare(req.object, transformed);

  updateResponsePatchAndWarnings(patches, { ...response, allowed: true });

  Log.debug({ ...reqMetadata, patches }, `Patches generated`);
  webhookTimer.stop();
  return { ...response, allowed: true };
}

export function updateResponsePatchAndWarnings(patches: Operation[], response: MutateResponse): void {
  // Only add the patch if there are patches to apply
  if (patches.length > 0) {
    response.patchType = "JSONPatch";
    // Webhook must be base64-encoded
    // https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#response
    response.patch = base64Encode(JSON.stringify(patches));
  }

  // Remove the warnings array if it's empty
  if (response.warnings && response.warnings.length < 1) {
    delete response.warnings;
  }
}
