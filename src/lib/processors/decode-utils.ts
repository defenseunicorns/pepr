import { convertFromBase64Map, convertToBase64Map } from "../utils";
import { kind, KubernetesObject } from "kubernetes-fluent-client";
import { PeprMutateRequest } from "../mutate-request";
import { clone } from "ramda";

export function decodeData(wrapped: PeprMutateRequest<KubernetesObject>): {
  skipped: string[];
  wrapped: PeprMutateRequest<KubernetesObject>;
} {
  let skipped: string[] = [];

  const isSecret = wrapped.Request.kind.version === "v1" && wrapped.Request.kind.kind === "Secret";
  if (isSecret) {
    // convertFromBase64Map modifies it's arg rather than returing a mod'ed copy (ye olde side-effect special, blerg)
    skipped = convertFromBase64Map(wrapped.Raw as unknown as kind.Secret);
  }

  return { skipped, wrapped };
}

export function reencodeData(wrapped: PeprMutateRequest<KubernetesObject>, skipped: string[]): KubernetesObject {
  const transformed = clone(wrapped.Raw);

  const isSecret = wrapped.Request.kind.version === "v1" && wrapped.Request.kind.kind === "Secret";
  if (isSecret) {
    // convertToBase64Map modifies it's arg rather than returing a mod'ed copy (ye olde side-effect special, blerg)
    convertToBase64Map(transformed as unknown as kind.Secret, skipped);
  }

  return transformed;
}
