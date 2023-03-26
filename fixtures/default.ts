import { Operation } from "@k8s";
import { V1Pod } from "@kubernetes/client-node";
import { State } from "@pepr";

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

const pod: V1Pod = {
  apiVersion: "v1",
  kind: "Pod",
  metadata: {
    name: "test",
    namespace: "default",
    labels: {
      thing: "test",
    },
  },
  spec: {
    initContainers: [
      { name: "test", image: "nginx:1.19.1" },
      { name: "test2", image: "nginx:1.19.1" },
    ],
    containers: [
      { name: "test", image: "nginx:1.19.2" },
      { name: "test2", image: "nginx:1.19.2" },
    ],
  },
};
ProcessRequest({
  object: pod,
  uid: "some-uid",
  kind: "Pod",
  resource: "",
  name: "thingy",
  operation: Operation.CREATE,
  userInfo: {
    username: "",
    uid: "",
    groups: [],
    extra: {},
  },
});
