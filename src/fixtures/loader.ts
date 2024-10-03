import { kind } from "kubernetes-fluent-client";

import { AdmissionRequest } from "../lib/k8s";
import createPod from "./data/create-pod.json";
import deletePod from "./data/delete-pod.json";

export function CreatePod() {
  return cloneObject<kind.Pod>(createPod);
}

export function DeletePod() {
  return cloneObject<kind.Pod>(deletePod);
}

function cloneObject<T>(obj: unknown): AdmissionRequest<T> {
  // JSON to avoid funky typescript silliness on jsonmodules
  return JSON.parse(JSON.stringify(obj)) as AdmissionRequest<T>;
}
