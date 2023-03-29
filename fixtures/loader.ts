import { Request } from "@k8s";
import { Pod } from "sdk/k8s/upstream";
import * as pod from "./data/pod.json";

export function POD() {
  // JSON to avoid funky typescript silliness on jsonmodules
  return JSON.parse(JSON.stringify(pod)) as Request<Pod>;
}
