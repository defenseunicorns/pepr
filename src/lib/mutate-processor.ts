// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import jsonPatch from "fast-json-patch";
import { kind, KubernetesObject } from "kubernetes-fluent-client";

import { Capability } from "./capability";
import { Errors } from "./errors";
import { shouldSkipRequest } from "./filter/filter";
import { MutateResponse } from "./k8s";
import { AdmissionRequest, Binding } from "./types";
import Log from "./telemetry/logger";
import { ModuleConfig } from "./module";
import { PeprMutateRequest } from "./mutate-request";
import { base64Encode, convertFromBase64Map, convertToBase64Map } from "./utils";

interface Bindable {
  req: AdmissionRequest;
  config: ModuleConfig;
  name: string;
  namespaces: string[];
  binding: Binding;
  actMeta: Record<string, string>;
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
  } catch (e) {
    return "An error occurred with the mutate action.";
  }
}

export async function mutateProcessor(
  config: ModuleConfig,
  capabilities: Capability[],
  req: AdmissionRequest,
  reqMetadata: Record<string, string>,
): Promise<MutateResponse> {
  let wrapped = new PeprMutateRequest(req);
  const response: MutateResponse = {
    uid: req.uid,
    warnings: [],
    allowed: false,
  };

  // Track data fields that should be skipped during decoding
  let skipDecode: string[] = [];

  // If the resource is a secret, decode the data
  const isSecret = req.kind.version === "v1" && req.kind.kind === "Secret";
  if (isSecret) {
    skipDecode = convertFromBase64Map(wrapped.Raw as unknown as kind.Secret);
  }

  Log.info(reqMetadata, `Processing request`);

  let bindables: Bindable[] = capabilities.flatMap(c =>
    c.bindings.map(b => ({
      req,
      config,
      name: c.name,
      namespaces: c.namespaces,
      binding: b,
      actMeta: { ...reqMetadata, name: c.name },
    })),
  );

  bindables = bindables.filter(b => {
    if (!b.binding.mutateCallback) {
      return false;
    }

    const shouldSkip = shouldSkipRequest(b.binding, b.req, b.namespaces, b.config?.alwaysIgnore?.namespaces);
    if (shouldSkip !== "") {
      Log.debug(shouldSkip);
      return false;
    }

    return true;
  });

  for (const { name, binding, actMeta } of bindables) {
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
        case Errors.reject:
          response.result = "Pepr module configured to reject on error";
          return response;

        case Errors.audit:
          response.auditAnnotations = response.auditAnnotations || {};
          response.auditAnnotations[Date.now()] = `Action failed: ${errorMessage}`;
          break;
      }
    }
  }

  // If we've made it this far, the request is allowed
  response.allowed = true;

  // If no capability matched the request, exit early
  if (bindables.length === 0) {
    Log.info(reqMetadata, `No matching actions found`);
    return response;
  }

  // delete operations can't be mutate, just return before the transformation
  if (req.operation === "DELETE") {
    return response;
  }

  const transformed = wrapped.Raw;

  // Post-process the Secret requests to convert it back to the original format
  if (isSecret) {
    convertToBase64Map(transformed as unknown as kind.Secret, skipDecode);
  }

  // Compare the original request to the modified request to get the patches
  const patches = jsonPatch.compare(req.object, transformed);

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

  Log.debug({ ...reqMetadata, patches }, `Patches generated`);

  return response;
}
