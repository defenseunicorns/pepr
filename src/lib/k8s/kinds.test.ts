// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { a, modelToGroupVersionKind } from "@k8s";
import test from "ava";

test("should return the correct GroupVersionKind for 'a.V1APIService'", t => {
  const { name } = a.APIService;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "apiregistration.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "APIService");
});

test("should return the correct GroupVersionKind for 'a.V1CertificateSigningRequest'", t => {
  const { name } = a.CertificateSigningRequest;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "certificates.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "CertificateSigningRequest");
});

test("should return the correct GroupVersionKind for 'a.V1ConfigMap'", t => {
  const { name } = a.ConfigMap;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "ConfigMap");
});

test("should return the correct GroupVersionKind for 'a.V1ControllerRevision'", t => {
  const { name } = a.ControllerRevision;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "apps");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "ControllerRevision");
});

test("should return the correct GroupVersionKind for 'a.V1CronJob'", t => {
  const { name } = a.CronJob;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "batch");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "CronJob");
});

test("should return the correct GroupVersionKind for 'a.V1CSIDriver'", t => {
  const { name } = a.CSIDriver;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "storage.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "CSIDriver");
});

test("should return the correct GroupVersionKind for 'a.V1CSIStorageCapacity'", t => {
  const { name } = a.CSIStorageCapacity;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "storage.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "CSIStorageCapacity");
});

test("should return the correct GroupVersionKind for 'a.V1CustomResourceDefinition'", t => {
  const { name } = a.CustomResourceDefinition;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "apiextensions.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "CustomResourceDefinition");
});

test("should return the correct GroupVersionKind for 'a.V1DaemonSet'", t => {
  const { name } = a.DaemonSet;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "apps");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "DaemonSet");
});

test("should return the correct GroupVersionKind for 'a.V1Deployment'", t => {
  const { name } = a.Deployment;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "apps");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "Deployment");
});

test("should return the correct GroupVersionKind for 'a.V1Endpoint'", t => {
  const { name } = a.Endpoint;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "Endpoints");
});

test("should return the correct GroupVersionKind for 'a.V1EndpointSlice'", t => {
  const { name } = a.EndpointSlice;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "discovery.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "EndpointSlice");
});

test("should return the correct GroupVersionKind for 'a.V1HorizontalPodAutoscaler'", t => {
  const { name } = a.HorizontalPodAutoscaler;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "autoscaling");
  t.is(gvk.version, "v2");
  t.is(gvk.kind, "HorizontalPodAutoscaler");
});

test("should return the correct GroupVersionKind for 'a.V1Ingress'", t => {
  const { name } = a.Ingress;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "networking.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "Ingress");
});

test("should return the correct GroupVersionKind for 'a.V1IngressClass'", t => {
  const { name } = a.IngressClass;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "networking.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "IngressClass");
});

test("should return the correct GroupVersionKind for 'a.V1Job'", t => {
  const { name } = a.Job;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "batch");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "Job");
});

test("should return the correct GroupVersionKind for 'a.V1LimitRange'", t => {
  const { name } = a.LimitRange;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "LimitRange");
});

test("should return the correct GroupVersionKind for 'a.V1LocalSubjectAccessReview'", t => {
  const { name } = a.LocalSubjectAccessReview;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "authorization.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "LocalSubjectAccessReview");
});

test("should return the correct GroupVersionKind for 'a.V1MutatingWebhookConfiguration'", t => {
  const { name } = a.MutatingWebhookConfiguration;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "admissionregistration.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "MutatingWebhookConfiguration");
});

test("should return the correct GroupVersionKind for 'a.V1Namespace'", t => {
  const { name } = a.Namespace;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "Namespace");
});

test("should return the correct GroupVersionKind for 'a.V1NetworkPolicy'", t => {
  const { name } = a.NetworkPolicy;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "networking.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "NetworkPolicy");
});

test("should return the correct GroupVersionKind for 'a.V1Node'", t => {
  const { name } = a.Node;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "Node");
});

test("should return the correct GroupVersionKind for 'a.V1PersistentVolume'", t => {
  const { name } = a.PersistentVolume;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "PersistentVolume");
});

test("should return the correct GroupVersionKind for 'a.V1PersistentVolumeClaim'", t => {
  const { name } = a.PersistentVolumeClaim;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "PersistentVolumeClaim");
});

test("should return the correct GroupVersionKind for 'a.V1Pod'", t => {
  const { name } = a.Pod;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "Pod");
});

test("should return the correct GroupVersionKind for 'a.V1PodDisruptionBudget'", t => {
  const { name } = a.PodDisruptionBudget;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "policy");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "PodDisruptionBudget");
});

test("should return the correct GroupVersionKind for 'a.V1PodTemplate'", t => {
  const { name } = a.PodTemplate;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "PodTemplate");
});

test("should return the correct GroupVersionKind for 'a.V1ReplicaSet'", t => {
  const { name } = a.ReplicaSet;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "apps");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "ReplicaSet");
});

test("should return the correct GroupVersionKind for 'a.V1ReplicationController'", t => {
  const { name } = a.ReplicationController;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "ReplicationController");
});

test("should return the correct GroupVersionKind for 'a.V1ResourceQuota'", t => {
  const { name } = a.ResourceQuota;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "ResourceQuota");
});

test("should return the correct GroupVersionKind for 'a.V1RuntimeClass'", t => {
  const { name } = a.RuntimeClass;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "node.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "RuntimeClass");
});

test("should return the correct GroupVersionKind for 'a.V1Secret'", t => {
  const { name } = a.Secret;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "Secret");
});

test("should return the correct GroupVersionKind for 'a.V1SelfSubjectAccessReview'", t => {
  const { name } = a.SelfSubjectAccessReview;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "authorization.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "SelfSubjectAccessReview");
});

test("should return the correct GroupVersionKind for 'a.V1SelfSubjectRulesReview'", t => {
  const { name } = a.SelfSubjectRulesReview;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "authorization.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "SelfSubjectRulesReview");
});

test("should return the correct GroupVersionKind for 'a.V1Service'", t => {
  const { name } = a.Service;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "Service");
});

test("should return the correct GroupVersionKind for 'a.V1ServiceAccount'", t => {
  const { name } = a.ServiceAccount;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "ServiceAccount");
});

test("should return the correct GroupVersionKind for 'a.V1StatefulSet'", t => {
  const { name } = a.StatefulSet;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "apps");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "StatefulSet");
});

test("should return the correct GroupVersionKind for 'a.V1StorageClass'", t => {
  const { name } = a.StorageClass;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "storage.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "StorageClass");
});

test("should return the correct GroupVersionKind for 'a.V1SubjectAccessReview'", t => {
  const { name } = a.SubjectAccessReview;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "authorization.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "SubjectAccessReview");
});

test("should return the correct GroupVersionKind for 'a.V1TokenReview'", t => {
  const { name } = a.TokenReview;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "authentication.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "TokenReview");
});

test("should return the correct GroupVersionKind for 'a.V1ValidatingWebhookConfiguration'", t => {
  const { name } = a.ValidatingWebhookConfiguration;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "admissionregistration.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "ValidatingWebhookConfiguration");
});

test("should return the correct GroupVersionKind for 'a.V1VolumeAttachment'", t => {
  const { name } = a.VolumeAttachment;
  const gvk = modelToGroupVersionKind(name);
  t.is(gvk.group, "storage.k8s.io");
  t.is(gvk.version, "v1");
  t.is(gvk.kind, "VolumeAttachment");
});
