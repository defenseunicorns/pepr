"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterKind = void 0;
exports.modelToGroupVersionKind = modelToGroupVersionKind;
const gvkMap = {
    /**
     * Represents a K8s Event resource (new Event in the events.k8s.io API)
     * Event is a report of an event somewhere in the cluster. It generally denotes some state change in the system.
     * Events have a limited retention time and triggers and messages may evolve with time. Event consumers should not
     * rely on the timing of an event with a given Reason reflecting a consistent underlying trigger, or the continued
     * existence of events with that Reason. Events should be treated as informative, best-effort, supplemental data.
     *
     * @see {@link https://kubernetes.io/docs/reference/kubernetes-api/cluster-resources/event-v1/}
     */
    EventsV1Event: {
        kind: "Event",
        version: "v1",
        group: "events.k8s.io",
    },
    /**
     * Represents a K8s Event resource (legacy core v1 Event, use the above one instead, it is more complete)
     * Event is a report of an event somewhere in the cluster. It generally denotes some state change in the system.
     * Events have a limited retention time and triggers and messages may evolve with time. Event consumers should not
     * rely on the timing of an event with a given Reason reflecting a consistent underlying trigger, or the continued
     * existence of events with that Reason. Events should be treated as informative, best-effort, supplemental data.
     *
     * @see {@link https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#event-v1-core}
     */
    CoreV1Event: {
        kind: "Event",
        version: "v1",
        group: "",
    },
    /**
     * Represents a K8s ClusterRole resource.
     * ClusterRole is a set of permissions that can be bound to a user or group in a cluster-wide scope.
     *
     * @see {@link https://kubernetes.io/docs/reference/access-authn-authz/rbac/#role-and-clusterrole}
     */
    V1ClusterRole: {
        kind: "ClusterRole",
        version: "v1",
        group: "rbac.authorization.k8s.io",
    },
    /**
     * Represents a K8s ClusterRoleBinding resource.
     * ClusterRoleBinding binds a ClusterRole to a user or group in a cluster-wide scope.
     *
     * @see {@link https://kubernetes.io/docs/reference/access-authn-authz/rbac/#rolebinding-and-clusterrolebinding}
     */
    V1ClusterRoleBinding: {
        kind: "ClusterRoleBinding",
        version: "v1",
        group: "rbac.authorization.k8s.io",
    },
    /**
     * Represents a K8s Role resource.
     * Role is a set of permissions that can be bound to a user or group in a namespace scope.
     *
     * @see {@link https://kubernetes.io/docs/reference/access-authn-authz/rbac/#role-and-clusterrole}
     */
    V1Role: {
        kind: "Role",
        version: "v1",
        group: "rbac.authorization.k8s.io",
    },
    /**
     * Represents a K8s RoleBinding resource.
     * RoleBinding binds a Role to a user or group in a namespace scope.
     *
     * @see {@link https://kubernetes.io/docs/reference/access-authn-authz/rbac/#rolebinding-and-clusterrolebinding}
     */
    V1RoleBinding: {
        kind: "RoleBinding",
        version: "v1",
        group: "rbac.authorization.k8s.io",
    },
    /**
     * Represents a K8s ConfigMap resource.
     * ConfigMap holds configuration data for pods to consume.
     *
     * @see {@link https://kubernetes.io/docs/concepts/configuration/configmap/}
     */
    V1ConfigMap: {
        kind: "ConfigMap",
        version: "v1",
        group: "",
    },
    /**
     * Represents a K8s Endpoints resource.
     * Endpoints expose a service's IP addresses and ports to other resources.
     *
     * @see {@link https://kubernetes.io/docs/concepts/services-networking/service/#endpoints}
     */
    V1Endpoint: {
        kind: "Endpoints",
        version: "v1",
        group: "",
        plural: "endpoints",
    },
    /**
     * Represents a K8s LimitRange resource.
     * LimitRange enforces constraints on the resource consumption of objects in a namespace.
     *
     * @see {@link https://kubernetes.io/docs/concepts/policy/limit-range/}
     */
    V1LimitRange: {
        kind: "LimitRange",
        version: "v1",
        group: "",
    },
    /**
     * Represents a K8s Namespace resource.
     * Namespace is a way to divide cluster resources between multiple users.
     *
     * @see {@link https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/}
     */
    V1Namespace: {
        kind: "Namespace",
        version: "v1",
        group: "",
    },
    /**
     * Represents a K8s Node resource.
     * Node is a worker machine in Kubernetes.
     *
     * @see {@link https://kubernetes.io/docs/concepts/architecture/nodes/}
     */
    V1Node: {
        kind: "Node",
        version: "v1",
        group: "",
    },
    /**
     * Represents a K8s PersistentVolumeClaim resource.
     * PersistentVolumeClaim is a user's request for and claim to a persistent volume.
     *
     * @see {@link https://kubernetes.io/docs/concepts/storage/persistent-volumes/#persistentvolumeclaims}
     */
    V1PersistentVolumeClaim: {
        kind: "PersistentVolumeClaim",
        version: "v1",
        group: "",
    },
    /**
     * Represents a K8s PersistentVolume resource.
     * PersistentVolume is a piece of storage in the cluster that has been provisioned by an administrator.
     *
     * @see {@link https://kubernetes.io/docs/concepts/storage/persistent-volumes/}
     */
    V1PersistentVolume: {
        kind: "PersistentVolume",
        version: "v1",
        group: "",
    },
    /**
     * Represents a K8s Pod resource.
     * Pod is the smallest and simplest unit in the Kubernetes object model.
     *
     * @see {@link https://kubernetes.io/docs/concepts/workloads/pods/}
     */
    V1Pod: {
        kind: "Pod",
        version: "v1",
        group: "",
    },
    /**
     * Represents a K8s PodTemplate resource.
     * PodTemplate is an object that describes the pod that will be created from a higher level abstraction.
     *
     * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/#pod-template}
     */
    V1PodTemplate: {
        kind: "PodTemplate",
        version: "v1",
        group: "",
    },
    /**
     * Represents a K8s ReplicationController resource.
     * ReplicationController ensures that a specified number of pod replicas are running at any given time.
     *
     * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller/}
     */
    V1ReplicationController: {
        kind: "ReplicationController",
        version: "v1",
        group: "",
    },
    /**
     * Represents a K8s ResourceQuota resource.
     * ResourceQuota provides constraints that limit resource consumption per namespace.
     *
     * @see {@link https://kubernetes.io/docs/concepts/policy/resource-quotas/}
     */
    V1ResourceQuota: {
        kind: "ResourceQuota",
        version: "v1",
        group: "",
    },
    /**
     * Represents a K8s Secret resource.
     * Secret holds secret data of a certain type.
     *
     * @see {@link https://kubernetes.io/docs/concepts/configuration/secret/}
     */
    V1Secret: {
        kind: "Secret",
        version: "v1",
        group: "",
    },
    /**
     * Represents a K8s ServiceAccount resource.
     * ServiceAccount is an identity that processes in a pod can use to access the Kubernetes API.
     *
     * @see {@link https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/}
     */
    V1ServiceAccount: {
        kind: "ServiceAccount",
        version: "v1",
        group: "",
    },
    /**
     * Represents a K8s Service resource.
     * Service is an abstraction which defines a logical set of Pods and a policy by which to access them.
     *
     * @see {@link https://kubernetes.io/docs/concepts/services-networking/service/}
     */
    V1Service: {
        kind: "Service",
        version: "v1",
        group: "",
    },
    /**
     * Represents a K8s MutatingWebhookConfiguration resource.
     * MutatingWebhookConfiguration configures a mutating admission webhook.
     *
     * @see {@link https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#configure-admission-webhooks-on-the-fly}
     */
    V1MutatingWebhookConfiguration: {
        kind: "MutatingWebhookConfiguration",
        version: "v1",
        group: "admissionregistration.k8s.io",
    },
    /**
     * Represents a K8s ValidatingWebhookConfiguration resource.
     * ValidatingWebhookConfiguration configures a validating admission webhook.
     *
     * @see {@link https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#configure-admission-webhooks-on-the-fly}
     */
    V1ValidatingWebhookConfiguration: {
        kind: "ValidatingWebhookConfiguration",
        version: "v1",
        group: "admissionregistration.k8s.io",
    },
    /**
     * Represents a K8s CustomResourceDefinition resource.
     * CustomResourceDefinition is a custom resource in a Kubernetes cluster.
     *
     * @see {@link https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/}
     */
    V1CustomResourceDefinition: {
        kind: "CustomResourceDefinition",
        version: "v1",
        group: "apiextensions.k8s.io",
    },
    /**
     * Represents a K8s APIService resource.
     * APIService represents a server for a particular API version and group.
     *
     * @see {@link https://kubernetes.io/docs/tasks/access-kubernetes-api/setup-extension-api-server/}
     */
    V1APIService: {
        kind: "APIService",
        version: "v1",
        group: "apiregistration.k8s.io",
    },
    /**
     * Represents a K8s ControllerRevision resource.
     * ControllerRevision is used to manage the history of a StatefulSet or DaemonSet.
     *
     * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#revision-history}
     */
    V1ControllerRevision: {
        kind: "ControllerRevision",
        version: "v1",
        group: "apps",
    },
    /**
     * Represents a K8s DaemonSet resource.
     * DaemonSet ensures that all (or some) nodes run a copy of a Pod.
     *
     * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/}
     */
    V1DaemonSet: {
        kind: "DaemonSet",
        version: "v1",
        group: "apps",
    },
    /**
     * Represents a K8s Deployment resource.
     * Deployment provides declarative updates for Pods and ReplicaSets.
     *
     * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/deployment/}
     */
    V1Deployment: {
        kind: "Deployment",
        version: "v1",
        group: "apps",
    },
    /**
     * Represents a K8s ReplicaSet resource.
     * ReplicaSet ensures that a specified number of pod replicas are running at any given time.
     *
     * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/}
     */
    V1ReplicaSet: {
        kind: "ReplicaSet",
        version: "v1",
        group: "apps",
    },
    /**
     * Represents a K8s StatefulSet resource.
     * StatefulSet is used to manage stateful applications.
     *
     * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/}
     */
    V1StatefulSet: {
        kind: "StatefulSet",
        version: "v1",
        group: "apps",
    },
    /**
     * Represents a K8s TokenReview resource.
     * TokenReview attempts to authenticate a token to a known user.
     *
     * @see {@link https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.20/#tokenreview-v1-authentication-k8s-io}
     */
    V1TokenReview: {
        kind: "TokenReview",
        version: "v1",
        group: "authentication.k8s.io",
    },
    /**
     * Represents a K8s LocalSubjectAccessReview resource.
     * LocalSubjectAccessReview checks whether a specific user can perform a specific action in a specific namespace.
     *
     * @see {@link https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.20/#localsubjectaccessreview-v1-authorization-k8s-io}
     */
    V1LocalSubjectAccessReview: {
        kind: "LocalSubjectAccessReview",
        version: "v1",
        group: "authorization.k8s.io",
    },
    /**
     * Represents a K8s SelfSubjectAccessReview resource.
     * SelfSubjectAccessReview checks whether the current user can perform a specific action.
     *
     * @see {@link https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.20/#selfsubjectaccessreview-v1-authorization-k8s-io}
     */
    V1SelfSubjectAccessReview: {
        kind: "SelfSubjectAccessReview",
        version: "v1",
        group: "authorization.k8s.io",
    },
    /**
     * Represents a K8s SelfSubjectRulesReview resource.
     * SelfSubjectRulesReview lists the permissions a specific user has within a namespace.
     *
     * @see {@link https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.20/#selfsubjectrulesreview-v1-authorization-k8s-io}
     */
    V1SelfSubjectRulesReview: {
        kind: "SelfSubjectRulesReview",
        version: "v1",
        group: "authorization.k8s.io",
    },
    /**
     * Represents a K8s SubjectAccessReview resource.
     * SubjectAccessReview checks whether a specific user can perform a specific action.
     *
     * @see {@link https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.20/#subjectaccessreview-v1-authorization-k8s-io}
     */
    V1SubjectAccessReview: {
        kind: "SubjectAccessReview",
        version: "v1",
        group: "authorization.k8s.io",
    },
    /**
     * Represents a K8s HorizontalPodAutoscaler resource.
     * HorizontalPodAutoscaler automatically scales the number of Pods in a replication controller, deployment, or replica set.
     *
     * @see {@link https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/}
     */
    V1HorizontalPodAutoscaler: {
        kind: "HorizontalPodAutoscaler",
        version: "v2",
        group: "autoscaling",
    },
    /**
     * Represents a K8s CronJob resource.
     * CronJob manages time-based jobs, specifically those that run periodically and complete after a successful execution.
     *
     * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/}
     */
    V1CronJob: {
        kind: "CronJob",
        version: "v1",
        group: "batch",
    },
    /**
     * Represents a K8s Job resource.
     * Job represents the configuration of a single job.
     *
     * @see {@link https://kubernetes.io/docs/concepts/workloads/controllers/job/}
     */
    V1Job: {
        kind: "Job",
        version: "v1",
        group: "batch",
    },
    /**
     * Represents a K8s CertificateSigningRequest resource.
     * CertificateSigningRequest represents a certificate signing request.
     *
     * @see {@link https://kubernetes.io/docs/reference/access-authn-authz/certificate-signing-requests/}
     */
    V1CertificateSigningRequest: {
        kind: "CertificateSigningRequest",
        version: "v1",
        group: "certificates.k8s.io",
    },
    /**
     * Represents a K8s EndpointSlice resource.
     * EndpointSlice represents a scalable set of network endpoints for a Kubernetes Service.
     *
     * @see {@link https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/}
     */
    V1EndpointSlice: {
        kind: "EndpointSlice",
        version: "v1",
        group: "discovery.k8s.io",
    },
    /**
     * Represents a K8s IngressClass resource.
     * IngressClass represents the class of the Ingress, referenced by the Ingress spec.
     *
     * @see {@link https://kubernetes.io/docs/concepts/services-networking/ingress/}
     */
    V1IngressClass: {
        kind: "IngressClass",
        version: "v1",
        group: "networking.k8s.io",
    },
    /**
     * Represents a K8s Ingress resource.
     * Ingress exposes HTTP and HTTPS routes from outside the cluster to services within the cluster.
     *
     * @see {@link https://kubernetes.io/docs/concepts/services-networking/ingress/}
     */
    V1Ingress: {
        kind: "Ingress",
        version: "v1",
        group: "networking.k8s.io",
        plural: "ingresses",
    },
    /**
     * Represents a K8s NetworkPolicy resource.
     * NetworkPolicy defines a set of rules for how pods communicate with each other.
     *
     * @see {@link https://kubernetes.io/docs/concepts/services-networking/network-policies/}
     */
    V1NetworkPolicy: {
        kind: "NetworkPolicy",
        version: "v1",
        group: "networking.k8s.io",
        plural: "networkpolicies",
    },
    /**
     * Represents a K8s RuntimeClass resource.
     * RuntimeClass is a cluster-scoped resource that surfaces container runtime properties to the control plane.
     *
     * @see {@link https://kubernetes.io/docs/concepts/containers/runtime-class/}
     */
    V1RuntimeClass: {
        kind: "RuntimeClass",
        version: "v1",
        group: "node.k8s.io",
    },
    /**
     * Represents a K8s PodDisruptionBudget resource.
     * PodDisruptionBudget is an API object that limits the number of pods of a replicated application that are down simultaneously.
     *
     * @see {@link https://kubernetes.io/docs/concepts/workloads/pods/disruptions/}
     */
    V1PodDisruptionBudget: {
        kind: "PodDisruptionBudget",
        version: "v1",
        group: "policy",
    },
    /**
     * Represents a K8s VolumeAttachment resource.
     * VolumeAttachment captures the intent to attach or detach the specified volume to/from the specified node.
     *
     * @see {@link https://kubernetes.io/docs/concepts/storage/storage-classes/}
     */
    V1VolumeAttachment: {
        kind: "VolumeAttachment",
        version: "v1",
        group: "storage.k8s.io",
    },
    /**
     * Represents a K8s CSIDriver resource.
     * CSIDriver captures information about a Container Storage Interface (CSI) volume driver.
     *
     * @see {@link https://kubernetes.io/docs/concepts/storage/volumes/}
     */
    V1CSIDriver: {
        kind: "CSIDriver",
        version: "v1",
        group: "storage.k8s.io",
    },
    /**
     * Represents a K8s CSIStorageCapacity resource.
     * CSIStorageCapacity stores the reported storage capacity of a CSI node or storage class.
     *
     * @see {@link https://kubernetes.io/docs/concepts/storage/csi/}
     */
    V1CSIStorageCapacity: {
        kind: "CSIStorageCapacity",
        version: "v1",
        group: "storage.k8s.io",
    },
    /**
     * Represents a K8s StorageClass resource.
     * StorageClass is a cluster-scoped resource that provides a way for administrators to describe the classes of storage they offer.
     *
     * @see {@link https://kubernetes.io/docs/concepts/storage/storage-classes/}
     */
    V1StorageClass: {
        kind: "StorageClass",
        version: "v1",
        group: "storage.k8s.io",
    },
};
/**
 * Converts a model name to a GroupVersionKind
 *
 * @param key The name of the model
 * @returns The GroupVersionKind for the model
 */
function modelToGroupVersionKind(key) {
    return gvkMap[key];
}
/**
 * Registers a new model and GroupVersionKind to be used within the fluent API.
 *
 * @param model Used to match the GroupVersionKind and define the type-data for the request
 * @param groupVersionKind Contains the match parameters to determine the request should be handled
 */
const RegisterKind = (model, groupVersionKind) => {
    const name = model.name;
    // Do not allow overwriting existing GVKs
    if (gvkMap[name]) {
        throw new Error(`GVK ${name} already registered`);
    }
    // Set the GVK
    gvkMap[name] = groupVersionKind;
};
exports.RegisterKind = RegisterKind;
