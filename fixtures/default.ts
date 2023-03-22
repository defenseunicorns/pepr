import { a } from "@k8s";
import { State } from "@pepr";
import "./test-mutations";
import TestMutations from "./test-mutations";

const state = new State({
  alwaysIgnore: {
    kinds: [a.MutatingWebhookConfiguration],
    namespaces: ["kube-system", "pepr-system"],
    labels: [{ "pepr.dev": "ignore" }],
  },
});

TestMutations(state.Register);
