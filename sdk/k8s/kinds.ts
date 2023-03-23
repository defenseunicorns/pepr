// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { GroupVersionKind } from "./types";

/**
 * Represents a K8s ConfigMap resource.
 * ConfigMap holds configuration data for pods to consume.
 * @see {@link https://kubernetes.io/docs/concepts/configuration/configmap/}
 */
export const ConfigMap: GroupVersionKind = {
  kind: "ConfigMap",
  version: "v1",
  group: "",
};

/**
 * Represents a K8s Endpoints resource.
 * Endpoints expose a service's IP addresses and ports to other resources.
 * @see {@link https://kubernetes.io/docs/concepts/services-networking/service/#endpoints}
 */
export const Endpoints: GroupVersionKind = {
  kind: "Endpoints",
  version: "v1",
  group: "",
};

/**
 * Represents a K8s Event resource.
 * Event is a report of an object's state change in the cluster.
 * @see {@link https://kubernetes.io/docs/reference/kubernetes-api/cluster-resources/event-v1/}
 */
export const Event: GroupVersionKind = {
  kind: "Event",
  version: "v1",
  group: "",
};

/**
 * Represents a K8s LimitRange resource.
 * LimitRange enforces constraints on the resource consumption of objects in a namespace.
 * @see {@link https://kubernetes.io/docs/concepts/policy/limit-range/}
 */
export const LimitRange: GroupVersionKind = {
  kind: "LimitRange",
  version: "v1",
  group: "",
};

/**
 * Represents a K8s Namespace resource.
 * Namespace is a way to divide cluster resources between multiple users.
 * @see {@link https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/}
 */
export const Namespace: GroupVersionKind = {
  kind: "Namespace",
  version: "v1",
  group: "",
};

/**
 * Represents a K8s Node resource.
 * Node is a worker machine in Kubernetes.
 * @see {@link https://kubernetes.io/docs/concepts/architecture/nodes/}
 */
export const Node: GroupVersionKind = {
  kind: "Node",
  version: "v1",
  group: "",
};

/**
 * Represents a K8s PersistentVolumeClaim resource.
 * PersistentVolumeClaim is a user's request for and claim to a persistent volume.
 * @see {@link https://kubernetes.io/docs/concepts/storage/persistent-volumes/#persistentvolumeclaims}
 */
export const PersistentVolumeClaim: GroupVersionKind = {
  kind: "PersistentVolumeClaim",
  version: "v1",
  group: "",
};

/**
 * Represents a K8s PersistentVolume resource.
 * PersistentVolume is a piece of storage in the cluster that has been provisioned by an administrator.
 * @see {@link https://kubernetes.io/docs/concepts/storage/persistent-volumes/}
 */
export const PersistentVolume: GroupVersionKind = {
  kind: "PersistentVolume",
  version: "v1",
  group: "",
};

/**
 * Represents a K8s Pod resource.
 * Pod is the smallest and simplest unit in the Kubernetes object model.
 * @see {@link https://kubernetes.io/docs/concepts/workloads/pods/}
 */
export const Pod: GroupVersionKind = {
  kind: "Pod",
  version: "v1",
  group: "",
};
/**
 * Represents a K8s PodTemplate resource.
 * PodTemplate is an object that describes the pod that will be created from a higher level abstraction.
 * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/#pod-template}
 */
export const PodTemplate: GroupVersionKind = {
  kind: "PodTemplate",
  version: "v1",
  group: "",
};

/**
 * Represents a K8s ReplicationController resource.
 * ReplicationController ensures that a specified number of pod replicas are running at any given time.
 * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller/}
 */
export const ReplicationController: GroupVersionKind = {
  kind: "ReplicationController",
  version: "v1",
  group: "",
};

/**
 * Represents a K8s ResourceQuota resource.
 * ResourceQuota provides constraints that limit resource consumption per namespace.
 * @see {@link https://kubernetes.io/docs/concepts/policy/resource-quotas/}
 */
export const ResourceQuota: GroupVersionKind = {
  kind: "ResourceQuota",
  version: "v1",
  group: "",
};

/**
 * Represents a K8s Secret resource.
 * Secret holds secret data of a certain type.
 * @see {@link https://kubernetes.io/docs/concepts/configuration/secret/}
 */
export const Secret: GroupVersionKind = {
  kind: "Secret",
  version: "v1",
  group: "",
};

/**
 * Represents a K8s ServiceAccount resource.
 * ServiceAccount is an identity that processes in a pod can use to access the Kubernetes API.
 * @see {@link https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/}
 */
export const ServiceAccount: GroupVersionKind = {
  kind: "ServiceAccount",
  version: "v1",
  group: "",
};

/**
 * Represents a K8s Service resource.
 * Service is an abstraction which defines a logical set of Pods and a policy by which to access them.
 * @see {@link https://kubernetes.io/docs/concepts/services-networking/service/}
 */
export const Service: GroupVersionKind = {
  kind: "Service",
  version: "v1",
  group: "",
};

/**
 * Represents a K8s MutatingWebhookConfiguration resource.
 * MutatingWebhookConfiguration configures a mutating admission webhook.
 * @see {@link https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#configure-admission-webhooks-on-the-fly}
 */
export const MutatingWebhookConfiguration: GroupVersionKind = {
  kind: "MutatingWebhookConfiguration",
  version: "v1",
  group: "admissionregistration.k8s.io",
};

/**
 * Represents a K8s ValidatingWebhookConfiguration resource.
 * ValidatingWebhookConfiguration configures a validating admission webhook.
 * @see {@link https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#configure-admission-webhooks-on-the-fly}
 */
export const ValidatingWebhookConfiguration: GroupVersionKind = {
  kind: "ValidatingWebhookConfiguration",
  version: "v1",
  group: "admissionregistration.k8s.io",
};
/**
 * Represents a K8s CustomResourceDefinition resource.
 * CustomResourceDefinition is a custom resource in a Kubernetes cluster.
 * @see {@link https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/}
 */
export const CustomResourceDefinition: GroupVersionKind = {
  kind: "CustomResourceDefinition",
  version: "v1",
  group: "apiextensions.k8s.io",
};

/**
 * Represents a K8s APIService resource.
 * APIService represents a server for a particular API version and group.
 * @see {@link https://kubernetes.io/docs/tasks/access-kubernetes-api/setup-extension-api-server/}
 */
export const APIService: GroupVersionKind = {
  kind: "APIService",
  version: "v1",
  group: "apiregistration.k8s.io",
};

/**
 * Represents a K8s ControllerRevision resource.
 * ControllerRevision is used to manage the history of a StatefulSet or DaemonSet.
 * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#revision-history}
 */
export const ControllerRevision: GroupVersionKind = {
  kind: "ControllerRevision",
  version: "v1",
  group: "apps",
};

/**
 * Represents a K8s DaemonSet resource.
 * DaemonSet ensures that all (or some) nodes run a copy of a Pod.
 * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/}
 */
export const DaemonSet: GroupVersionKind = {
  kind: "DaemonSet",
  version: "v1",
  group: "apps",
};

/**
 * Represents a K8s Deployment resource.
 * Deployment provides declarative updates for Pods and ReplicaSets.
 * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/deployment/}
 */
export const Deployment: GroupVersionKind = {
  kind: "Deployment",
  version: "v1",
  group: "apps",
};

/**
 * Represents a K8s ReplicaSet resource.
 * ReplicaSet ensures that a specified number of pod replicas are running at any given time.
 * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/}
 */
export const ReplicaSet: GroupVersionKind = {
  kind: "ReplicaSet",
  version: "v1",
  group: "apps",
};

/**
 * Represents a K8s StatefulSet resource.
 * StatefulSet is used to manage stateful applications.
 * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/}
 */
export const StatefulSet: GroupVersionKind = {
  kind: "StatefulSet",
  version: "v1",
  group: "apps",
};

/**
 * Represents a K8s TokenReview resource.
 * TokenReview attempts to authenticate a token to a known user.
 * @see {@link https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.20/#tokenreview-v1-authentication-k8s-io}
 */
export const TokenReview: GroupVersionKind = {
  kind: "TokenReview",
  version: "v1",
  group: "authentication.k8s.io",
};

/**
 * Represents a K8s LocalSubjectAccessReview resource.
 * LocalSubjectAccessReview checks whether a specific user can perform a specific action in a specific namespace.
 * @see {@link https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.20/#localsubjectaccessreview-v1-authorization-k8s-io}
 */
export const LocalSubjectAccessReview: GroupVersionKind = {
  kind: "LocalSubjectAccessReview",
  version: "v1",
  group: "authorization.k8s.io",
};

/**
 * Represents a K8s SelfSubjectAccessReview resource.
 * SelfSubjectAccessReview checks whether the current user can perform a specific action.
 * @see {@link https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.20/#selfsubjectaccessreview-v1-authorization-k8s-io}
 */
export const SelfSubjectAccessReview: GroupVersionKind = {
  kind: "SelfSubjectAccessReview",
  version: "v1",
  group: "authorization.k8s.io",
};

/**
 * Represents a K8s SelfSubjectRulesReview resource.
 * SelfSubjectRulesReview lists the permissions a specific user has within a namespace.
 * @see {@link https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.20/#selfsubjectrulesreview-v1-authorization-k8s-io}
 */
export const SelfSubjectRulesReview: GroupVersionKind = {
  kind: "SelfSubjectRulesReview",
  version: "v1",
  group: "authorization.k8s.io",
};

/**
 * Represents a K8s SubjectAccessReview resource.
 * SubjectAccessReview checks whether a specific user can perform a specific action.
 * @see {@link https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.20/#subjectaccessreview-v1-authorization-k8s-io}
 */
export const SubjectAccessReview: GroupVersionKind = {
  kind: "SubjectAccessReview",
  version: "v1",
  group: "authorization.k8s.io",
};

/**
 * Represents a K8s HorizontalPodAutoscaler resource.
 * HorizontalPodAutoscaler automatically scales the number of Pods in a replication controller, deployment, or replica set.
 * @see {@link https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/}
 */
export const HorizontalPodAutoscaler: GroupVersionKind = {
  kind: "HorizontalPodAutoscaler",
  version: "v2",
  group: "autoscaling",
};

/**
 * Represents a K8s CronJob resource.
 * CronJob manages time-based jobs, specifically those that run periodically and complete after a successful execution.
 * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/}
 */
export const CronJob: GroupVersionKind = {
  kind: "CronJob",
  version: "v1",
  group: "batch",
};

/**
 * Represents a K8s Job resource.
 * Job represents the configuration of a single job.
 * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/job/}
 */
export const Job: GroupVersionKind = {
  kind: "Job",
  version: "v1",
  group: "batch",
};

/**
 * Represents a K8s CertificateSigningRequest resource.
 * CertificateSigningRequest represents a certificate signing request.
 * @see {@link https://kubernetes.io/docs/reference/access-authn-authz/certificate-signing-requests/}
 */
export const CertificateSigningRequest: GroupVersionKind = {
  kind: "CertificateSigningRequest",
  version: "v1",
  group: "certificates.k8s.io",
};

/**
 * Represents a K8s Lease resource.
 * Lease is a cluster-scoped resource that coordinates the acquisition, renewal, and release of access to shared resources.
 * @see {@link https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.20/#lease-v1-coordination-k8s-io}
 */
export const Lease: GroupVersionKind = {
  kind: "Lease",
  version: "v1",
  group: "coordination.k8s.io",
};

/**
 * Represents a K8s EndpointSlice resource.
 * EndpointSlice represents a scalable set of network endpoints for a Kubernetes Service.
 * @see {@link https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/}
 */
export const EndpointSlice: GroupVersionKind = {
  kind: "EndpointSlice",
  version: "v1",
  group: "discovery.k8s.io",
};

/**
 * Represents a K8s FlowSchema resource.
 * FlowSchema defines how requests are classified for priority and fairness.
 * @see {@link https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.20/#flowschema-v1beta2-flowcontrol-apiserver-k8s-io}
 */
export const FlowSchema: GroupVersionKind = {
  kind: "FlowSchema",
  version: "v1beta2",
  group: "flowcontrol.apiserver.k8s.io",
};

/**
 * Represents a K8s PriorityLevelConfiguration resource.
 * PriorityLevelConfiguration defines the configuration of a priority level.
 * @see {@link https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.20/#prioritylevelconfiguration-v1beta2-flowcontrol-apiserver-k8s-io}
 */
export const PriorityLevelConfiguration: GroupVersionKind = {
  kind: "PriorityLevelConfiguration",
  version: "v1beta2",
  group: "flowcontrol.apiserver.k8s.io",
};

/**
 * Represents a K8s NodeMetrics resource.
 * NodeMetrics provides metrics for a single node.
 * @see {@link https://kubernetes.io/docs/tasks/debug-application-cluster/resource-metrics-pipeline/}
 */
export const NodeMetrics: GroupVersionKind = {
  kind: "NodeMetrics",
  version: "v1beta1",
  group: "metrics.k8s.io",
};

/**
 * Represents a K8s PodMetrics resource.
 * PodMetrics provides metrics for a single pod.
 * @see {@link https://kubernetes.io/docs/tasks/debug-application-cluster/resource-metrics-pipeline/}
 */
export const PodMetrics: GroupVersionKind = {
  kind: "PodMetrics",
  version: "v1beta1",
  group: "metrics.k8s.io",
};

/**
 * Represents a K8s IngressClass resource.
 * IngressClass represents the class of the Ingress, referenced by the Ingress spec.
 * @see {@link https://kubernetes.io/docs/concepts/services-networking/ingress/}
 */
export const IngressClass: GroupVersionKind = {
  kind: "IngressClass",
  version: "v1",
  group: "networking.k8s.io",
};

/**
 * Represents a K8s Ingress resource.
 * Ingress exposes HTTP and HTTPS routes from outside the cluster to services within the cluster.
 * @see {@link https://kubernetes.io/docs/concepts/services-networking/ingress/}
 */
export const Ingress: GroupVersionKind = {
  kind: "Ingress",
  version: "v1",
  group: "networking.k8s.io",
};

/**
 * Represents a K8s NetworkPolicy resource.
 * NetworkPolicy defines a set of rules for how pods communicate with each other.
 * @see {@link https://kubernetes.io/docs/concepts/services-networking/network-policies/}
 */
export const NetworkPolicy: GroupVersionKind = {
  kind: "NetworkPolicy",
  version: "v1",
  group: "networking.k8s.io",
};

/**
 * Represents a K8s RuntimeClass resource.
 * RuntimeClass is a cluster-scoped resource that surfaces container runtime properties to the control plane.
 * @see {@link https://kubernetes.io/docs/concepts/containers/runtime-class/}
 */
export const RuntimeClass: GroupVersionKind = {
  kind: "RuntimeClass",
  version: "v1",
  group: "node.k8s.io",
};

/**
 * Represents a K8s PodDisruptionBudget resource.
 * PodDisruptionBudget is an API object that limits the number of pods of a replicated application that are down simultaneously.
 * @see {@link https://kubernetes.io/docs/concepts/workloads/pods/disruptions/}
 */
export const PodDisruptionBudget: GroupVersionKind = {
  kind: "PodDisruptionBudget",
  version: "v1",
  group: "policy",
};

/**
 * Represents a K8s VolumeAttachment resource.
 * VolumeAttachment captures the intent to attach or detach the specified volume to/from the specified node.
 * @see {@link https://kubernetes.io/docs/concepts/storage/storage-classes/}
 */
export const VolumeAttachment: GroupVersionKind = {
  kind: "VolumeAttachment",
  version: "v1",
  group: "storage.k8s.io",
};

/**
 * Represents a K8s CSIDriver resource.
 * CSIDriver captures information about a Container Storage Interface (CSI) volume driver.
 * @see {@link https://kubernetes.io/docs/concepts/storage/volumes/}
 */
export const CSIDriver: GroupVersionKind = {
  kind: "CSIDriver",
  version: "v1",
  group: "storage.k8s.io",
};

/**
 * Represents a K8s CSIStorageCapacity resource.
 * CSIStorageCapacity stores the reported storage capacity of a CSI node or storage class.
 * @see {@link https://kubernetes.io/docs/concepts/storage/csi/}
 */
export const CSIStorageCapacity: GroupVersionKind = {
  kind: "CSIStorageCapacity",
  version: "v1",
  group: "storage.k8s.io",
};

/**
 * Represents a K8s StorageClass resource.
 * StorageClass is a cluster-scoped resource that provides a way for administrators to describe the classes of storage they offer.
 * @see {@link https://kubernetes.io/docs/concepts/storage/storage-classes/}
 */
export const StorageClass: GroupVersionKind = {
  kind: "StorageClass",
  version: "v1",
  group: "storage.k8s.io",
};

/**
 * Represents a K8s VolumeSnapshot resource.
 * VolumeSnapshot is a user request for creating a point-in-time snapshot of a PersistentVolumeClaim.
 * @see {@link https://kubernetes.io/docs/concepts/storage/volume-snapshots/}
 */
export const VolumeSnapshot: GroupVersionKind = {
  kind: "VolumeSnapshot",
  version: "v1",
  group: "snapshot.storage.k8s.io",
};
