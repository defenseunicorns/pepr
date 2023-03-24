import { a } from "@k8s";
import { State } from "@pepr";
import TestMutations from "./test-mutations";

const state = new State({
  id: "20e17cf6-a2e4-46b2-b626-75d88d96c88b",
  description: "",
  alwaysIgnore: {
    kinds: [a.MutatingWebhookConfiguration],
    namespaces: ["kube-system", "pepr-system"],
    labels: [{ "pepr.dev": "ignore" }],
  },
});

export const { ProcessRequest } = state;

TestMutations(state.Register);
