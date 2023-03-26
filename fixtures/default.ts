import { Operation, Request } from "@k8s";
import { State } from "@pepr";
import { Pod } from "sdk/k8s/upstream";

import TestMutations from "./test-mutations";

const state = new State({
  id: "20e17cf6-a2e4-46b2-b626-75d88d96c88b",
  description: "",
  alwaysIgnore: {
    namespaces: ["kube-system", "pepr-system"],
    labels: [{ "pepr.dev": "ignore" }],
  },
});

export const { ProcessRequest } = state;

TestMutations(state.Register);

const example: Request<Pod> = {
  uid: "af5c3d45-72b8-11eb-a3a3-0242ac130003",
  kind: {
    group: "",
    version: "v1",
    kind: "Pod",
  },
  resource: {
    group: "",
    version: "v1",
    resource: "pods",
  },
  subResource: "",
  name: "nginx",
  namespace: "default",
  operation: Operation.CREATE,
  userInfo: {
    username: "system:serviceaccount:kube-system:replicaset-controller",
    uid: "95c8f0ca-d31a-4d3f-9f27-9a2a2661ab3c",
    groups: [
      "system:serviceaccounts",
      "system:serviceaccounts:kube-system",
      "system:authenticated",
    ],
  },
  object: {
    metadata: {
      name: "nginx",
      namespace: "default",
    },
    spec: {
      containers: [
        {
          name: "nginx",
          image: "nginx:latest",
        },
      ],
    },
  },
  oldObject: {},
  dryRun: false,
  options: null,
};

ProcessRequest(example);
