import { a, Request } from "@k8s";
import * as pod from "./data/pod.json";

export function POD() {
  // JSON to avoid funky typescript silliness on jsonmodules
  return JSON.parse(JSON.stringify(pod)) as Request<a.Pod>;
}
