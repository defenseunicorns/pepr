import { Request, a } from "../src/lib/k8s/index.js";
import cm1 from "./data/cm1.json" assert { type: "json" };
import deployment1 from "./data/deployment1.json" assert { type: "json" };
import ns1 from "./data/ns1.json" assert { type: "json" };
import pod1 from "./data/pod1.json" assert { type: "json" };
import pod2 from "./data/pod2.json" assert { type: "json" };
import svc1 from "./data/svc1.json" assert { type: "json" };

export function POD1() {
  return cloneObject<a.Pod>(pod1);
}

export function POD2() {
  return cloneObject<a.Pod>(pod2);
}

export function SVC1() {
  return cloneObject<a.Service>(svc1);
}

export function DEPLOYMENT1() {
  return cloneObject<a.Deployment>(deployment1);
}

export function CM1() {
  return cloneObject<a.ConfigMap>(cm1);
}

export function NS1() {
  return cloneObject<a.Namespace>(ns1);
}

function cloneObject<T>(obj: unknown): Request<T> {
  // JSON to avoid funky typescript silliness on jsonmodules
  return JSON.parse(JSON.stringify(obj)) as Request<T>;
}
