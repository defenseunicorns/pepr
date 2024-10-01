// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors

import { expect, test } from "@jest/globals";

import { kind, modelToGroupVersionKind } from "./index";
import { RegisterKind } from "./kinds";
import { GroupVersionKind } from "./types";

const testCases = [
  {
    name: kind.Event,
    expected: { group: "events.k8s.io", version: "v1", kind: "Event" },
  },
  {
    name: kind.CoreEvent,
    expected: { group: "", version: "v1", kind: "Event" },
  },
  {
    name: kind.ClusterRole,
    expected: { group: "rbac.authorization.k8s.io", version: "v1", kind: "ClusterRole" },
  },
  {
    name: kind.ClusterRoleBinding,
    expected: { group: "rbac.authorization.k8s.io", version: "v1", kind: "ClusterRoleBinding" },
  },
  {
    name: kind.Role,
    expected: { group: "rbac.authorization.k8s.io", version: "v1", kind: "Role" },
  },
  {
    name: kind.RoleBinding,
    expected: { group: "rbac.authorization.k8s.io", version: "v1", kind: "RoleBinding" },
  },
  { name: kind.Pod, expected: { group: "", version: "v1", kind: "Pod" } },
  { name: kind.Deployment, expected: { group: "apps", version: "v1", kind: "Deployment" } },
  { name: kind.StatefulSet, expected: { group: "apps", version: "v1", kind: "StatefulSet" } },
  { name: kind.DaemonSet, expected: { group: "apps", version: "v1", kind: "DaemonSet" } },
  { name: kind.Job, expected: { group: "batch", version: "v1", kind: "Job" } },
  { name: kind.CronJob, expected: { group: "batch", version: "v1", kind: "CronJob" } },
  { name: kind.ConfigMap, expected: { group: "", version: "v1", kind: "ConfigMap" } },
  { name: kind.Secret, expected: { group: "", version: "v1", kind: "Secret" } },
  { name: kind.Service, expected: { group: "", version: "v1", kind: "Service" } },
  { name: kind.ServiceAccount, expected: { group: "", version: "v1", kind: "ServiceAccount" } },
  { name: kind.Namespace, expected: { group: "", version: "v1", kind: "Namespace" } },
  {
    name: kind.HorizontalPodAutoscaler,
    expected: { group: "autoscaling", version: "v2", kind: "HorizontalPodAutoscaler" },
  },
  {
    name: kind.CustomResourceDefinition,
    expected: { group: "apiextensions.k8s.io", version: "v1", kind: "CustomResourceDefinition" },
  },
  { name: kind.Ingress, expected: { group: "networking.k8s.io", version: "v1", kind: "Ingress" } },
  {
    name: kind.NetworkPolicy,
    expected: {
      group: "networking.k8s.io",
      version: "v1",
      kind: "NetworkPolicy",
      plural: "networkpolicies",
    },
  },
  { name: kind.Node, expected: { group: "", version: "v1", kind: "Node" } },
  { name: kind.PersistentVolume, expected: { group: "", version: "v1", kind: "PersistentVolume" } },
  {
    name: kind.PersistentVolumeClaim,
    expected: { group: "", version: "v1", kind: "PersistentVolumeClaim" },
  },
  { name: kind.Pod, expected: { group: "", version: "v1", kind: "Pod" } },
  {
    name: kind.PodDisruptionBudget,
    expected: { group: "policy", version: "v1", kind: "PodDisruptionBudget" },
  },
  { name: kind.PodTemplate, expected: { group: "", version: "v1", kind: "PodTemplate" } },
  { name: kind.ReplicaSet, expected: { group: "apps", version: "v1", kind: "ReplicaSet" } },
  {
    name: kind.ReplicationController,
    expected: { group: "", version: "v1", kind: "ReplicationController" },
  },
  { name: kind.ResourceQuota, expected: { group: "", version: "v1", kind: "ResourceQuota" } },
  {
    name: kind.RuntimeClass,
    expected: { group: "node.k8s.io", version: "v1", kind: "RuntimeClass" },
  },
  { name: kind.Secret, expected: { group: "", version: "v1", kind: "Secret" } },
  {
    name: kind.SelfSubjectAccessReview,
    expected: { group: "authorization.k8s.io", version: "v1", kind: "SelfSubjectAccessReview" },
  },
  {
    name: kind.SelfSubjectRulesReview,
    expected: { group: "authorization.k8s.io", version: "v1", kind: "SelfSubjectRulesReview" },
  },
  { name: kind.Service, expected: { group: "", version: "v1", kind: "Service" } },
  { name: kind.ServiceAccount, expected: { group: "", version: "v1", kind: "ServiceAccount" } },
  { name: kind.StatefulSet, expected: { group: "apps", version: "v1", kind: "StatefulSet" } },
  {
    name: kind.StorageClass,
    expected: { group: "storage.k8s.io", version: "v1", kind: "StorageClass" },
  },
  {
    name: kind.SubjectAccessReview,
    expected: { group: "authorization.k8s.io", version: "v1", kind: "SubjectAccessReview" },
  },
  {
    name: kind.TokenReview,
    expected: { group: "authentication.k8s.io", version: "v1", kind: "TokenReview" },
  },
  {
    name: kind.ValidatingWebhookConfiguration,
    expected: {
      group: "admissionregistration.k8s.io",
      version: "v1",
      kind: "ValidatingWebhookConfiguration",
    },
  },
  {
    name: kind.VolumeAttachment,
    expected: { group: "storage.k8s.io", version: "v1", kind: "VolumeAttachment" },
  },
];

test.each(testCases)(
  "should return the correct GroupVersionKind for '%s'",
  ({ name, expected }) => {
    const { name: modelName } = name;
    const gvk = modelToGroupVersionKind(modelName);
    try {
      expect(gvk.group).toBe(expected.group);
      expect(gvk.version).toBe(expected.version);
      expect(gvk.kind).toBe(expected.kind);
    } catch (error) {
      console.error(
        `Failed for model ${modelName}: Expected GroupVersionKind to be ${JSON.stringify(
          expected,
        )}, but got ${JSON.stringify(gvk)}`,
      );
      throw error;
    }
  },
);

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
  const { name } = kind.VolumeAttachment;
  const gvk = modelToGroupVersionKind(name);
  expect(() => {
    RegisterKind(kind.VolumeAttachment, {
      kind: gvk.kind,
      version: gvk.version,
      group: gvk.group,
    });
  }).toThrow(`GVK ${name} already registered`);
});
