// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { K8s, KubernetesObject, RegisterKind } from "kubernetes-fluent-client";
import Log from "./telemetry/logger";
import { Binding, DeepPartial } from "./types";
import { Operation } from "./enums";
import { PeprMutateRequest } from "./mutate-request";

export function addFinalizer<K extends KubernetesObject>(request: PeprMutateRequest<K>) {
  // if a DELETE is being processed, don't add a finalizer
  if (request.Request.operation === Operation.DELETE) {
    return;
  }

  // if an UPDATE is being processed and it HAS a deletionTimestamp, the
  //  resource is going through a pre-delete flow so don't (re-)add a finalizer
  if (request.Request.operation === Operation.UPDATE && request.Raw.metadata?.deletionTimestamp) {
    return;
  }

  const peprFinal = "pepr.dev/finalizer";
  const finalizers = request.Raw.metadata?.finalizers || [];
  if (!finalizers.includes(peprFinal)) {
    finalizers.push(peprFinal);
  }

  request.Merge({ metadata: { finalizers } } as DeepPartial<K>);
}

export async function removeFinalizer(binding: Binding, obj: KubernetesObject) {
  const peprFinal = "pepr.dev/finalizer";
  const meta = obj.metadata!;
  const resource = `${meta.namespace || "ClusterScoped"}/${meta.name}`;

  Log.debug({ obj }, `Removing finalizer '${peprFinal}' from '${resource}'`);

  // ensure request model is registerd with KFC (for non-built in CRD's, etc.)
  const { model, kind } = binding;
  try {
    RegisterKind(model, kind);
  } catch (e) {
    const expected = e.message === `GVK ${model.name} already registered`;
    if (!expected) {
      Log.error({ model, kind, error: e }, `Error registering "${kind}" during finalization.`);
      return;
    }
  }

  // remove pepr finalizers
  const finalizers = meta.finalizers?.filter(f => f !== peprFinal) || [];

  // JSON Patch - replace a key
  // https://datatracker.ietf.org/doc/html/rfc6902/#section-4.3
  obj = await K8s(model, meta).Patch([
    {
      op: "replace",
      path: `/metadata/finalizers`,
      value: finalizers,
    },
  ]);
  Log.debug({ obj }, `Removed finalizer '${peprFinal}' from '${resource}'`);
}
