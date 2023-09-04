// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test } from "@jest/globals";

import { a, modelToGroupVersionKind } from "./index";

test("should return the correct GroupVersionKind for 'a.ClusterRole'", () => {
  const { name } = a.ClusterRole;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("rbac.authorization.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("ClusterRole");
});

test("should return the correct GroupVersionKind for 'a.ClusterRoleBinding'", () => {
  const { name } = a.ClusterRoleBinding;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("rbac.authorization.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("ClusterRoleBinding");
});

test("should return the correct GroupVersionKind for 'a.Role'", () => {
  const { name } = a.Role;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("rbac.authorization.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("Role");
});

test("should return the correct GroupVersionKind for 'a.RoleBinding'", () => {
  const { name } = a.RoleBinding;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("rbac.authorization.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("RoleBinding");
});

test("should return the correct GroupVersionKind for 'a.V1APIService'", () => {
  const { name } = a.APIService;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("apiregistration.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("APIService");
});

test("should return the correct GroupVersionKind for 'a.V1CertificateSigningRequest'", () => {
  const { name } = a.CertificateSigningRequest;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("certificates.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("CertificateSigningRequest");
});

test("should return the correct GroupVersionKind for 'a.V1ConfigMap'", () => {
  const { name } = a.ConfigMap;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("ConfigMap");
});

test("should return the correct GroupVersionKind for 'a.V1ControllerRevision'", () => {
  const { name } = a.ControllerRevision;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("apps");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("ControllerRevision");
});

test("should return the correct GroupVersionKind for 'a.V1CronJob'", () => {
  const { name } = a.CronJob;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("batch");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("CronJob");
});

test("should return the correct GroupVersionKind for 'a.V1CSIDriver'", () => {
  const { name } = a.CSIDriver;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("storage.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("CSIDriver");
});

test("should return the correct GroupVersionKind for 'a.V1CSIStorageCapacity'", () => {
  const { name } = a.CSIStorageCapacity;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("storage.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("CSIStorageCapacity");
});

test("should return the correct GroupVersionKind for 'a.V1CustomResourceDefinition'", () => {
  const { name } = a.CustomResourceDefinition;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("apiextensions.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("CustomResourceDefinition");
});

test("should return the correct GroupVersionKind for 'a.V1DaemonSet'", () => {
  const { name } = a.DaemonSet;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("apps");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("DaemonSet");
});

test("should return the correct GroupVersionKind for 'a.V1Deployment'", () => {
  const { name } = a.Deployment;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("apps");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("Deployment");
});

test("should return the correct GroupVersionKind for 'a.V1EndpointSlice'", () => {
  const { name } = a.EndpointSlice;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("discovery.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("EndpointSlice");
});

test("should return the correct GroupVersionKind for 'a.V1HorizontalPodAutoscaler'", () => {
  const { name } = a.HorizontalPodAutoscaler;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("autoscaling");
  expect(gvk.version).toBe("v2");
  expect(gvk.kind).toBe("HorizontalPodAutoscaler");
});

test("should return the correct GroupVersionKind for 'a.V1Ingress'", () => {
  const { name } = a.Ingress;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("networking.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("Ingress");
});

test("should return the correct GroupVersionKind for 'a.V1IngressClass'", () => {
  const { name } = a.IngressClass;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("networking.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("IngressClass");
});

test("should return the correct GroupVersionKind for 'a.V1Job'", () => {
  const { name } = a.Job;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("batch");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("Job");
});

test("should return the correct GroupVersionKind for 'a.V1LimitRange'", () => {
  const { name } = a.LimitRange;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("LimitRange");
});

test("should return the correct GroupVersionKind for 'a.V1LocalSubjectAccessReview'", () => {
  const { name } = a.LocalSubjectAccessReview;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("authorization.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("LocalSubjectAccessReview");
});

test("should return the correct GroupVersionKind for 'a.V1MutatingWebhookConfiguration'", () => {
  const { name } = a.MutatingWebhookConfiguration;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("admissionregistration.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("MutatingWebhookConfiguration");
});

test("should return the correct GroupVersionKind for 'a.V1Namespace'", () => {
  const { name } = a.Namespace;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("Namespace");
});

test("should return the correct GroupVersionKind for 'a.V1NetworkPolicy'", () => {
  const { name } = a.NetworkPolicy;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("networking.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("NetworkPolicy");
});

test("should return the correct GroupVersionKind for 'a.V1Node'", () => {
  const { name } = a.Node;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("Node");
});

test("should return the correct GroupVersionKind for 'a.V1PersistentVolume'", () => {
  const { name } = a.PersistentVolume;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("PersistentVolume");
});

test("should return the correct GroupVersionKind for 'a.V1PersistentVolumeClaim'", () => {
  const { name } = a.PersistentVolumeClaim;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("PersistentVolumeClaim");
});

test("should return the correct GroupVersionKind for 'a.V1Pod'", () => {
  const { name } = a.Pod;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("Pod");
});

test("should return the correct GroupVersionKind for 'a.V1PodDisruptionBudget'", () => {
  const { name } = a.PodDisruptionBudget;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("policy");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("PodDisruptionBudget");
});

test("should return the correct GroupVersionKind for 'a.V1PodTemplate'", () => {
  const { name } = a.PodTemplate;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("PodTemplate");
});

test("should return the correct GroupVersionKind for 'a.V1ReplicaSet'", () => {
  const { name } = a.ReplicaSet;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("apps");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("ReplicaSet");
});

test("should return the correct GroupVersionKind for 'a.V1ReplicationController'", () => {
  const { name } = a.ReplicationController;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("ReplicationController");
});

test("should return the correct GroupVersionKind for 'a.V1ResourceQuota'", () => {
  const { name } = a.ResourceQuota;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("ResourceQuota");
});

test("should return the correct GroupVersionKind for 'a.V1RuntimeClass'", () => {
  const { name } = a.RuntimeClass;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("node.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("RuntimeClass");
});

test("should return the correct GroupVersionKind for 'a.V1Secret'", () => {
  const { name } = a.Secret;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("Secret");
});

test("should return the correct GroupVersionKind for 'a.V1SelfSubjectAccessReview'", () => {
  const { name } = a.SelfSubjectAccessReview;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("authorization.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("SelfSubjectAccessReview");
});

test("should return the correct GroupVersionKind for 'a.V1SelfSubjectRulesReview'", () => {
  const { name } = a.SelfSubjectRulesReview;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("authorization.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("SelfSubjectRulesReview");
});

test("should return the correct GroupVersionKind for 'a.V1Service'", () => {
  const { name } = a.Service;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("Service");
});

test("should return the correct GroupVersionKind for 'a.V1ServiceAccount'", () => {
  const { name } = a.ServiceAccount;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("ServiceAccount");
});

test("should return the correct GroupVersionKind for 'a.V1StatefulSet'", () => {
  const { name } = a.StatefulSet;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("apps");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("StatefulSet");
});

test("should return the correct GroupVersionKind for 'a.V1StorageClass'", () => {
  const { name } = a.StorageClass;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("storage.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("StorageClass");
});

test("should return the correct GroupVersionKind for 'a.V1SubjectAccessReview'", () => {
  const { name } = a.SubjectAccessReview;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("authorization.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("SubjectAccessReview");
});

test("should return the correct GroupVersionKind for 'a.V1TokenReview'", () => {
  const { name } = a.TokenReview;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("authentication.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("TokenReview");
});

test("should return the correct GroupVersionKind for 'a.V1ValidatingWebhookConfiguration'", () => {
  const { name } = a.ValidatingWebhookConfiguration;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("admissionregistration.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("ValidatingWebhookConfiguration");
});

test("should return the correct GroupVersionKind for 'a.V1VolumeAttachment'", () => {
  const { name } = a.VolumeAttachment;
  const gvk = modelToGroupVersionKind(name);
  expect(gvk.group).toBe("storage.k8s.io");
  expect(gvk.version).toBe("v1");
  expect(gvk.kind).toBe("VolumeAttachment");
});
