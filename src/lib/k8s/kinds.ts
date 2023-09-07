// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test } from "@jest/globals";

import { a, modelToGroupVersionKind } from "./index";
import { GroupVersionKind } from "./types";
import { RegisterKind } from "./kinds";

const testCases = [
  { name: a.ClusterRole, expected: { group: "rbac.authorization.k8s.io", version: "v1", kind: "ClusterRole" } },
  {
    name: a.ClusterRoleBinding,
    expected: { group: "rbac.authorization.k8s.io", version: "v1", kind: "ClusterRoleBinding" },
  },
  { name: a.Role, expected: { group: "rbac.authorization.k8s.io", version: "v1", kind: "Role" } },
  { name: a.RoleBinding, expected: { group: "rbac.authorization.k8s.io", version: "v1", kind: "RoleBinding" } },
  { name: a.Pod, expected: { group: "", version: "v1", kind: "Pod" } },
  { name: a.Deployment, expected: { group: "apps", version: "v1", kind: "Deployment" } },
  { name: a.StatefulSet, expected: { group: "apps", version: "v1", kind: "StatefulSet" } },
  { name: a.DaemonSet, expected: { group: "apps", version: "v1", kind: "DaemonSet" } },
  { name: a.Job, expected: { group: "batch", version: "v1", kind: "Job" } },
  { name: a.CronJob, expected: { group: "batch", version: "v1", kind: "CronJob" } },
  { name: a.ConfigMap, expected: { group: "", version: "v1", kind: "ConfigMap" } },
  { name: a.Secret, expected: { group: "", version: "v1", kind: "Secret" } },
  { name: a.Service, expected: { group: "", version: "v1", kind: "Service" } },
  { name: a.ServiceAccount, expected: { group: "", version: "v1", kind: "ServiceAccount" } },
  { name: a.Namespace, expected: { group: "", version: "v1", kind: "Namespace" } },
  {
    name: a.HorizontalPodAutoscaler,
    expected: { group: "autoscaling", version: "v2", kind: "HorizontalPodAutoscaler" },
  },
  {
    name: a.CustomResourceDefinition,
    expected: { group: "apiextensions.k8s.io", version: "v1", kind: "CustomResourceDefinition" },
  },
  { name: a.Ingress, expected: { group: "networking.k8s.io", version: "v1", kind: "Ingress" } },
  { name: a.NetworkPolicy, expected: { group: "networking.k8s.io", version: "v1", kind: "NetworkPolicy" } },
  { name: a.Node, expected: { group: "", version: "v1", kind: "Node" } },
  { name: a.PersistentVolume, expected: { group: "", version: "v1", kind: "PersistentVolume" } },
  { name: a.PersistentVolumeClaim, expected: { group: "", version: "v1", kind: "PersistentVolumeClaim" } },
  { name: a.Pod, expected: { group: "", version: "v1", kind: "Pod" } },
  { name: a.PodDisruptionBudget, expected: { group: "policy", version: "v1", kind: "PodDisruptionBudget" } },
  { name: a.PodTemplate, expected: { group: "", version: "v1", kind: "PodTemplate" } },
  { name: a.ReplicaSet, expected: { group: "apps", version: "v1", kind: "ReplicaSet" } },
  { name: a.ReplicationController, expected: { group: "", version: "v1", kind: "ReplicationController" } },
  { name: a.ResourceQuota, expected: { group: "", version: "v1", kind: "ResourceQuota" } },
  { name: a.RuntimeClass, expected: { group: "node.k8s.io", version: "v1", kind: "RuntimeClass" } },
  { name: a.Secret, expected: { group: "", version: "v1", kind: "Secret" } },
  {
    name: a.SelfSubjectAccessReview,
    expected: { group: "authorization.k8s.io", version: "v1", kind: "SelfSubjectAccessReview" },
  },
  {
    name: a.SelfSubjectRulesReview,
    expected: { group: "authorization.k8s.io", version: "v1", kind: "SelfSubjectRulesReview" },
  },
  { name: a.Service, expected: { group: "", version: "v1", kind: "Service" } },
  { name: a.ServiceAccount, expected: { group: "", version: "v1", kind: "ServiceAccount" } },
  { name: a.StatefulSet, expected: { group: "apps", version: "v1", kind: "StatefulSet" } },
  { name: a.StorageClass, expected: { group: "storage.k8s.io", version: "v1", kind: "StorageClass" } },
  {
    name: a.SubjectAccessReview,
    expected: { group: "authorization.k8s.io", version: "v1", kind: "SubjectAccessReview" },
  },
  { name: a.TokenReview, expected: { group: "authentication.k8s.io", version: "v1", kind: "TokenReview" } },
  {
    name: a.ValidatingWebhookConfiguration,
    expected: { group: "admissionregistration.k8s.io", version: "v1", kind: "ValidatingWebhookConfiguration" },
  },
  { name: a.VolumeAttachment, expected: { group: "storage.k8s.io", version: "v1", kind: "VolumeAttachment" } },
];

test.each(testCases)("should return the correct GroupVersionKind for '%s'", ({ name, expected }) => {
  const { name: modelName } = name;
  const gvk = modelToGroupVersionKind(modelName);
  try {
    expect(gvk.group).toBe(expected.group);
    expect(gvk.version).toBe(expected.version);
    expect(gvk.kind).toBe(expected.kind);
  } catch (error) {
    console.error(`Failed for model ${modelName}: Expected GroupVersionKind to be ${JSON.stringify(expected)}, but got ${JSON.stringify(gvk)}`);
    throw error;
  }
});

test("new registered type", () => {
  class foo implements GroupVersionKind {
    kind: string;
    group: string;
    constructor() {
      this.kind = "foo";
      this.group = "bar";
    }
  }
  RegisterKind(foo, new foo());
});

test("throws an error for already registered", () => {
  const { name } = a.VolumeAttachment;
  const gvk = modelToGroupVersionKind(name);
  expect(() => {
    RegisterKind(a.VolumeAttachment, {
      kind: gvk.kind,
      version: gvk.version,
      group: gvk.group,
    });
  }).toThrow(`GVK ${name} already registered`);
});