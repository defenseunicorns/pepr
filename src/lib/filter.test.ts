// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test } from "@jest/globals";
import { kind, modelToGroupVersionKind } from "kubernetes-fluent-client";

import { CreatePod, DeletePod } from "../fixtures/loader";
import { shouldSkipRequest } from "./filter";
import { Event } from "./types";

const callback = () => undefined;

const podKind = modelToGroupVersionKind(kind.Pod.name);

test("should reject when name does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "bleh",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(true);
});

test("should reject when kind does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: modelToGroupVersionKind(kind.CronJob.name),
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(true);
});

test("should reject when group does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: modelToGroupVersionKind(kind.CronJob.name),
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(true);
});

test("should reject when version does not match", () => {
  const binding = {
    model: kind.Pod,
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

  expect(shouldSkipRequest(binding, pod, [])).toBe(true);
});

test("should allow when group, version, and kind match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(false);
});

test("should allow when kind match and others are empty", () => {
  const binding = {
    model: kind.Pod,
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

  expect(shouldSkipRequest(binding, pod, [])).toBe(false);
});

test("should reject when teh capability namespace does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, ["bleh", "bleh2"])).toBe(true);
});

test("should reject when namespace does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: ["bleh"],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(true);
});

test("should allow when namespace is match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: ["default", "unicorn", "things"],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(false);
});

test("should reject when label does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
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

  expect(shouldSkipRequest(binding, pod, [])).toBe(true);
});

test("should allow when label is match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
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

  expect(shouldSkipRequest(binding, pod, [])).toBe(false);
});

test("should reject when annotation does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
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

  expect(shouldSkipRequest(binding, pod, [])).toBe(true);
});

test("should allow when annotation is match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
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

  expect(shouldSkipRequest(binding, pod, [])).toBe(false);
});

test("should use `oldObject` when the operation is `DELETE`", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Delete,
    kind: podKind,
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

  expect(shouldSkipRequest(binding, pod, [])).toBe(false);
});
