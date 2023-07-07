import { Request, a } from "../lib/k8s";
import createPod from "./data/create-pod.json";
import deletePod from "./data/delete-pod.json";

export function CreatePod() {
  return cloneObject<a.Pod>(createPod);
}

export function DeletePod() {
  return cloneObject<a.Pod>(deletePod);
}

function cloneObject<T>(obj: unknown): Request<T> {
  // JSON to avoid funky typescript silliness on jsonmodules
  return JSON.parse(JSON.stringify(obj)) as Request<T>;
}
