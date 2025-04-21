import { PeprValidateRequest } from "pepr";

import { WebApp } from "./generated/webapp-v1alpha1";

const invalidNamespaces = ["kube-system", "kube-public", "_unknown_", "pepr-system", "default"];

export async function validator(req: PeprValidateRequest<WebApp>) {
  const ns = req.Raw.metadata?.namespace ?? "_unknown_";

  if (req.Raw.spec.replicas > 7) {
    return req.Deny("max replicas is 7 to prevent noisy neighbors");
  }
  if (invalidNamespaces.includes(ns)) {
    if (req.Raw.metadata?.namespace === "default") {
      return req.Deny("default namespace is not allowed");
    }
    return req.Deny("invalid namespace");
  }

  return req.Approve();
}
