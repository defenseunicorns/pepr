import test from "ava";
import { POD1 } from "../../fixtures/loader";
import { shouldSkipRequest } from "./filter";
import { gvkMap } from "./k8s";

test("should reject when name does not match", t => {
  const binding = {
    kind: gvkMap.V1Pod,
    filters: {
      name: "bleh",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback: () => null,
  };
  const pod = POD1();

  t.true(shouldSkipRequest(binding, pod));
});

test("should reject when kind does not match", t => {
  const binding = {
    kind: gvkMap.V1ConfigMap,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback: () => null,
  };
  const pod = POD1();

  t.true(shouldSkipRequest(binding, pod));
});

test("should reject when group does not match", t => {
  const binding = {
    kind: gvkMap.V1CronJob,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback: () => null,
  };
  const pod = POD1();

  t.true(shouldSkipRequest(binding, pod));
});

test("should reject when version does not match", t => {
  const binding = {
    kind: {
      group: "",
      version: "v2",
      kind: "Pod",
    },
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback: () => null,
  };
  const pod = POD1();

  t.true(shouldSkipRequest(binding, pod));
});

test("should allow when group, version, and kind match", t => {
  const binding = {
    kind: gvkMap.V1Pod,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback: () => null,
  };
  const pod = POD1();

  t.false(shouldSkipRequest(binding, pod));
});

test("should allow when kind match and others are empty", t => {
  const binding = {
    kind: {
      group: "",
      version: "",
      kind: "Pod",
    },
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback: () => null,
  };
  const pod = POD1();

  t.false(shouldSkipRequest(binding, pod));
});

test("should reject when namespace does not match", t => {
  const binding = {
    kind: gvkMap.V1Pod,
    filters: {
      name: "",
      namespaces: ["bleh"],
      labels: {},
      annotations: {},
    },
    callback: () => null,
  };
  const pod = POD1();

  t.true(shouldSkipRequest(binding, pod));
});

test("should allow when namespace is match", t => {
  const binding = {
    kind: gvkMap.V1Pod,
    filters: {
      name: "",
      namespaces: ["default", "unicorn", "things"],
      labels: {},
      annotations: {},
    },
    callback: () => null,
  };
  const pod = POD1();

  t.false(shouldSkipRequest(binding, pod));
});

test("should reject when label does not match", t => {
  const binding = {
    kind: gvkMap.V1Pod,
    filters: {
      name: "",
      namespaces: [],
      labels: {
        foo: "bar",
      },
      annotations: {},
    },
    callback: () => null,
  };
  const pod = POD1();

  t.true(shouldSkipRequest(binding, pod));
});

test("should allow when label is match", t => {
  const binding = {
    kind: gvkMap.V1Pod,
    filters: {
      name: "",

      namespaces: [],
      labels: {
        foo: "bar",
        test: "test1",
      },
      annotations: {},
    },
    callback: () => null,
  };

  const pod = POD1();
  pod.object.metadata.labels = {
    foo: "bar",
    test: "test1",
    test2: "test2",
  };

  t.false(shouldSkipRequest(binding, pod));
});

test("should reject when annotation does not match", t => {
  const binding = {
    kind: gvkMap.V1Pod,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {
        foo: "bar",
      },
    },
    callback: () => null,
  };
  const pod = POD1();

  t.true(shouldSkipRequest(binding, pod));
});

test("should allow when annotation is match", t => {
  const binding = {
    kind: gvkMap.V1Pod,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {
        foo: "bar",
        test: "test1",
      },
    },
    callback: () => null,
  };

  const pod = POD1();
  pod.object.metadata.annotations = {
    foo: "bar",
    test: "test1",
    test2: "test2",
  };

  t.false(shouldSkipRequest(binding, pod));
});
