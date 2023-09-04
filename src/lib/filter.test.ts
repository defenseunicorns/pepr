// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test } from "@jest/globals";

import { CreatePod, DeletePod } from "../fixtures/loader";
import { shouldSkipRequest } from "./filter";
import { gvkMap } from "./k8s/kinds";
import { Event } from "./types";

const callback = () => undefined;

test("should reject when name does not match", () => {
  const binding = {
    event: Event.Any,
    kind: gvkMap.V1Pod,
    filters: {
      name: "bleh",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod)).toBe(true);
});

test("should reject when kind does not match", () => {
  const binding = {
    event: Event.Any,
    kind: gvkMap.V1ConfigMap,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod)).toBe(true);
});

test("should reject when group does not match", () => {
  const binding = {
    event: Event.Any,
    kind: gvkMap.V1CronJob,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod)).toBe(true);
});

test("should reject when version does not match", () => {
  const binding = {
    event: Event.Any,
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
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod)).toBe(true);
});

test("should allow when group, version, and kind match", () => {
  const binding = {
    event: Event.Any,
    kind: gvkMap.V1Pod,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod)).toBe(false);
});

test("should allow when kind match and others are empty", () => {
  const binding = {
    event: Event.Any,
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
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod)).toBe(false);
});

test("should reject when namespace does not match", () => {
  const binding = {
    event: Event.Any,
    kind: gvkMap.V1Pod,
    filters: {
      name: "",
      namespaces: ["bleh"],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod)).toBe(true);
});

test("should allow when namespace is match", () => {
  const binding = {
    event: Event.Any,
    kind: gvkMap.V1Pod,
    filters: {
      name: "",
      namespaces: ["default", "unicorn", "things"],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod)).toBe(false);
});

test("should reject when label does not match", () => {
  const binding = {
    event: Event.Any,
    kind: gvkMap.V1Pod,
    filters: {
      name: "",
      namespaces: [],
      labels: {
        foo: "bar",
      },
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod)).toBe(true);
});

test("should allow when label is match", () => {
  const binding = {
    event: Event.Any,
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
    callback,
  };

  const pod = CreatePod();
  pod.object.metadata = pod.object.metadata || {};
  pod.object.metadata.labels = {
    foo: "bar",
    test: "test1",
    test2: "test2",
  };

  expect(shouldSkipRequest(binding, pod)).toBe(false);
});

test("should reject when annotation does not match", () => {
  const binding = {
    event: Event.Any,
    kind: gvkMap.V1Pod,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {
        foo: "bar",
      },
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod)).toBe(true);
});

test("should allow when annotation is match", () => {
  const binding = {
    event: Event.Any,
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
    callback,
  };

  const pod = CreatePod();
  pod.object.metadata = pod.object.metadata || {};
  pod.object.metadata.annotations = {
    foo: "bar",
    test: "test1",
    test2: "test2",
  };

  expect(shouldSkipRequest(binding, pod)).toBe(false);
});

test("should use `oldObject` when the operation is `DELETE`", () => {
  const binding = {
    event: Event.Delete,
    kind: gvkMap.V1Pod,
    filters: {
      name: "",
      namespaces: [],
      labels: {
        "app.kubernetes.io/name": "cool-name-podinfo",
      },
      annotations: {
        "prometheus.io/scrape": "true",
      },
    },
    callback,
  };

  const pod = DeletePod();

  expect(shouldSkipRequest(binding, pod)).toBe(false);
});
