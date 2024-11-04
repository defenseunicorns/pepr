"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const index_1 = require("./index");
const kinds_1 = require("./kinds");
const testCases = [
    {
        name: index_1.kind.Event,
        expected: { group: "events.k8s.io", version: "v1", kind: "Event" },
    },
    {
        name: index_1.kind.CoreEvent,
        expected: { group: "", version: "v1", kind: "Event" },
    },
    {
        name: index_1.kind.ClusterRole,
        expected: { group: "rbac.authorization.k8s.io", version: "v1", kind: "ClusterRole" },
    },
    {
        name: index_1.kind.ClusterRoleBinding,
        expected: { group: "rbac.authorization.k8s.io", version: "v1", kind: "ClusterRoleBinding" },
    },
    {
        name: index_1.kind.Role,
        expected: { group: "rbac.authorization.k8s.io", version: "v1", kind: "Role" },
    },
    {
        name: index_1.kind.RoleBinding,
        expected: { group: "rbac.authorization.k8s.io", version: "v1", kind: "RoleBinding" },
    },
    { name: index_1.kind.Pod, expected: { group: "", version: "v1", kind: "Pod" } },
    { name: index_1.kind.Deployment, expected: { group: "apps", version: "v1", kind: "Deployment" } },
    { name: index_1.kind.StatefulSet, expected: { group: "apps", version: "v1", kind: "StatefulSet" } },
    { name: index_1.kind.DaemonSet, expected: { group: "apps", version: "v1", kind: "DaemonSet" } },
    { name: index_1.kind.Job, expected: { group: "batch", version: "v1", kind: "Job" } },
    { name: index_1.kind.CronJob, expected: { group: "batch", version: "v1", kind: "CronJob" } },
    { name: index_1.kind.ConfigMap, expected: { group: "", version: "v1", kind: "ConfigMap" } },
    { name: index_1.kind.Secret, expected: { group: "", version: "v1", kind: "Secret" } },
    { name: index_1.kind.Service, expected: { group: "", version: "v1", kind: "Service" } },
    { name: index_1.kind.ServiceAccount, expected: { group: "", version: "v1", kind: "ServiceAccount" } },
    { name: index_1.kind.Namespace, expected: { group: "", version: "v1", kind: "Namespace" } },
    {
        name: index_1.kind.HorizontalPodAutoscaler,
        expected: { group: "autoscaling", version: "v2", kind: "HorizontalPodAutoscaler" },
    },
    {
        name: index_1.kind.CustomResourceDefinition,
        expected: { group: "apiextensions.k8s.io", version: "v1", kind: "CustomResourceDefinition" },
    },
    { name: index_1.kind.Ingress, expected: { group: "networking.k8s.io", version: "v1", kind: "Ingress" } },
    {
        name: index_1.kind.NetworkPolicy,
        expected: {
            group: "networking.k8s.io",
            version: "v1",
            kind: "NetworkPolicy",
            plural: "networkpolicies",
        },
    },
    { name: index_1.kind.Node, expected: { group: "", version: "v1", kind: "Node" } },
    { name: index_1.kind.PersistentVolume, expected: { group: "", version: "v1", kind: "PersistentVolume" } },
    {
        name: index_1.kind.PersistentVolumeClaim,
        expected: { group: "", version: "v1", kind: "PersistentVolumeClaim" },
    },
    { name: index_1.kind.Pod, expected: { group: "", version: "v1", kind: "Pod" } },
    {
        name: index_1.kind.PodDisruptionBudget,
        expected: { group: "policy", version: "v1", kind: "PodDisruptionBudget" },
    },
    { name: index_1.kind.PodTemplate, expected: { group: "", version: "v1", kind: "PodTemplate" } },
    { name: index_1.kind.ReplicaSet, expected: { group: "apps", version: "v1", kind: "ReplicaSet" } },
    {
        name: index_1.kind.ReplicationController,
        expected: { group: "", version: "v1", kind: "ReplicationController" },
    },
    { name: index_1.kind.ResourceQuota, expected: { group: "", version: "v1", kind: "ResourceQuota" } },
    {
        name: index_1.kind.RuntimeClass,
        expected: { group: "node.k8s.io", version: "v1", kind: "RuntimeClass" },
    },
    { name: index_1.kind.Secret, expected: { group: "", version: "v1", kind: "Secret" } },
    {
        name: index_1.kind.SelfSubjectAccessReview,
        expected: { group: "authorization.k8s.io", version: "v1", kind: "SelfSubjectAccessReview" },
    },
    {
        name: index_1.kind.SelfSubjectRulesReview,
        expected: { group: "authorization.k8s.io", version: "v1", kind: "SelfSubjectRulesReview" },
    },
    { name: index_1.kind.Service, expected: { group: "", version: "v1", kind: "Service" } },
    { name: index_1.kind.ServiceAccount, expected: { group: "", version: "v1", kind: "ServiceAccount" } },
    { name: index_1.kind.StatefulSet, expected: { group: "apps", version: "v1", kind: "StatefulSet" } },
    {
        name: index_1.kind.StorageClass,
        expected: { group: "storage.k8s.io", version: "v1", kind: "StorageClass" },
    },
    {
        name: index_1.kind.SubjectAccessReview,
        expected: { group: "authorization.k8s.io", version: "v1", kind: "SubjectAccessReview" },
    },
    {
        name: index_1.kind.TokenReview,
        expected: { group: "authentication.k8s.io", version: "v1", kind: "TokenReview" },
    },
    {
        name: index_1.kind.ValidatingWebhookConfiguration,
        expected: {
            group: "admissionregistration.k8s.io",
            version: "v1",
            kind: "ValidatingWebhookConfiguration",
        },
    },
    {
        name: index_1.kind.VolumeAttachment,
        expected: { group: "storage.k8s.io", version: "v1", kind: "VolumeAttachment" },
    },
];
globals_1.test.each(testCases)("should return the correct GroupVersionKind for '%s'", ({ name, expected }) => {
    const { name: modelName } = name;
    const gvk = (0, index_1.modelToGroupVersionKind)(modelName);
    try {
        (0, globals_1.expect)(gvk.group).toBe(expected.group);
        (0, globals_1.expect)(gvk.version).toBe(expected.version);
        (0, globals_1.expect)(gvk.kind).toBe(expected.kind);
    }
    catch (error) {
        console.error(`Failed for model ${modelName}: Expected GroupVersionKind to be ${JSON.stringify(expected)}, but got ${JSON.stringify(gvk)}`);
        throw error;
    }
});
(0, globals_1.test)("new registered type", () => {
    class foo {
        kind;
        group;
        constructor() {
            this.kind = "foo";
            this.group = "bar";
        }
    }
    (0, kinds_1.RegisterKind)(foo, new foo());
});
(0, globals_1.test)("throws an error for already registered", () => {
    const { name } = index_1.kind.VolumeAttachment;
    const gvk = (0, index_1.modelToGroupVersionKind)(name);
    (0, globals_1.expect)(() => {
        (0, kinds_1.RegisterKind)(index_1.kind.VolumeAttachment, {
            kind: gvk.kind,
            version: gvk.version,
            group: gvk.group,
        });
    }).toThrow(`GVK ${name} already registered`);
});
