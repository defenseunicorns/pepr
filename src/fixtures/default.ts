import { Log, State } from "@pepr";
import { CM1, DEPLOYMENT1, NS1, POD1, POD2, SVC1 } from "./loader";

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

Log.info(ProcessRequest(SVC1()), "svc1");
Log.info(ProcessRequest(POD1()), "pod1");
Log.info(ProcessRequest(POD2()), "pod2");
Log.info(ProcessRequest(CM1()), "cm1");
Log.info(ProcessRequest(NS1()), "ns1");
Log.info(ProcessRequest(DEPLOYMENT1()), "deployment1");
