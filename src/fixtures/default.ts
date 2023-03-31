import { Log, State } from "@pepr";
import { POD } from "./loader";

import TestMutations from "./test-mutations";

const state = new State({
  id: "20e17cf6-a2e4-46b2-b626-75d88d96c88b",
  description: "",
  alwaysIgnore: {
    namespaces: ["kube-system", "pepr-system"],
    labels: [{ "pepr.dev": "ignore" }],
  },
  rejectOnError: false,
});

export const { ProcessRequest } = state;

TestMutations(state.Register);

const example = POD();

const request = ProcessRequest(example);
Log.info(request, "Final response");
