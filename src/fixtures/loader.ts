import { kind } from "kubernetes-fluent-client";

import { AdmissionRequest } from "../lib/types";
import admissionRequestCreatePod from "./data/admission-create-pod.json";
import admissionRequestDeletePod from "./data/admission-delete-pod.json";
import admissionRequestCreateClusterRole from "./data/admission-create-clusterrole.json";
import admissionRequestCreateDeployment from "./data/admission-create-deployment.json";

export function AdmissionRequestCreateDeployment() {
  return cloneObject<kind.Deployment>(admissionRequestCreateDeployment);
}

export function AdmissionRequestCreatePod() {
  return cloneObject<kind.Pod>(admissionRequestCreatePod);
}

export function AdmissionRequestDeletePod() {
  return cloneObject<kind.Pod>(admissionRequestDeletePod);
}

export function AdmissionRequestCreateClusterRole() {
  return cloneObject<kind.ClusterRole>(admissionRequestCreateClusterRole);
}

function cloneObject<T>(obj: unknown): AdmissionRequest<T> {
  // JSON to avoid funky typescript silliness on jsonmodules
  return JSON.parse(JSON.stringify(obj)) as AdmissionRequest<T>;
}
