// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

export function nsTemplate() {
  return `
    apiVersion: v1
    kind: Namespace
    metadata:
        name: pepr-system
        {{- if .Values.namespace.annotations }}
        annotations:
            {{- toYaml .Values.namespace.annotations | nindent 6 }}
        {{- end }}
        {{- if .Values.namespace.labels }}
        labels:
            {{- toYaml .Values.namespace.labels | nindent 6 }}
        {{- end }}
    `;
}
export function admissionServiceTemplate() {
  return `
      apiVersion: v1
      kind: Service
      metadata:
        name: pepr-{{ .Values.uuid }}
        namespace: pepr-system
        labels:
          pepr.dev/controller: admission
      spec:
        selector:
          app: pepr-{{ .Values.uuid }}
          pepr.dev/controller: admission
        ports:
          - port: 443
            targetPort: 3000
    `;
}
export function helmWatcherService() {
  return `
      apiVersion: v1
      kind: Service
      metadata:
        name: pepr-{{ .Values.uuid }}-watcher
        namespace: pepr-system
        labels:
          pepr.dev/controller: watcher
      spec:
        selector:
          app: pepr-{{ .Values.uuid }}-watcher
          pepr.dev/controller: watcher
        ports:
          - port: 443
            targetPort: 3000  
    `;
}

export function mutatingWebhookConfiguration() {
  return `
    apiVersion: admissionregistration.k8s.io/v1
    kind: MutatingWebhookConfiguration
    metadata:
        name: pepr-e64f19bc-52ce-5472-9add-4a0b6080c360
    webhooks:
        - name: pepr-e64f19bc-52ce-5472-9add-4a0b6080c360.pepr.dev
        admissionReviewVersions:
            - v1
            - v1beta1
        clientConfig:
            caBundle: >-
            LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tDQpNSUlDdERDQ0FaeWdBd0lCQWdJQkFUQU5CZ2txaGtpRzl3MEJBUXNGQURBY01Sb3dHQVlEVlFRREV4RlFaWEJ5DQpJRVZ3YUdWdFpYSmhiQ0JEUVRBZUZ3MHlOREF5TWpReE5ESTNNVE5hRncweU5UQXlNalF4TkRJM01UTmFNQUF3DQpnZ0VpTUEwR0NTcUdTSWIzRFFFQkFRVUFBNElCRHdBd2dnRUtBb0lCQVFDS2MvQTRJTXo2Qk1xc29oNUxOcFFpDQpKUjlnMkQ5Rk9CME5oNGV2ajdyMDBFYjBvby9oRFpXRS9RbHNlVzRUWGdxY2ZMWTRKVU5HQUtLbndRVG5MMzdyDQp1VDlpRm9xSlBUY0V3dGxFQnlZOVpRRzJqM2x4TE5hV1lEaDY1YThwU09TSE5XTXZOOFVyS29Fb0pEc0o1S0dEDQpvZC9icC9LQjVZTFk1SFlqd1BKUDVoYkR6SnBzNlgzMkxON3dzck9BSVA2dEt2VmtRTExRVFhPNFdFVWhONTR6DQpydlB6WUFrNEtwLy95OGdrN0xyTU5JT3VCVG9XaGttQVJCMjJUemI1SStHbUZ4MGYzdlRRTFg4MVFnaDZPbDgzDQpnV2E5THpCeEI4QU1sTk5UR2RyNzQ3YWFpamFBcWQrSFJjcDRJMnFhUUJ6REpPaHRoaEQ5NXh6WFJ3NWNsTFdkDQpBZ01CQUFHakhUQWJNQXdHQTFVZEV3UUZNQU1CQWY4d0N3WURWUjBQQkFRREFnTDBNQTBHQ1NxR1NJYjNEUUVCDQpDd1VBQTRJQkFRQTV5MUdVbDVWNVRrRTdXSk51UTZDZDJ6WnVUWlFCbHRnaytZTnZsN0dibjZmWlhML1lSTjEwDQp4a0V3aytKR3QyN05EeHA0ZFZBYzluU3BwYXc2blU2a2o3c0tYc0s0MWNreGJSOU5nSGgrUVR3MEhIcUFNbEtBDQpFUldHUWg1N1paVlEwbWFTTFk1ZUdEMXQ5VVJYc0RRTzFrZmtBQXhqSUppWGZiamVpQVVsZDBETVk5MnY1SmtBDQpVT3p4VWhpeGZqRFpyOTdkOG1rb1JwQ1J0TTZOREtGaHdHdTVKK0U1VVlvdHVQRzd1K0puUE9ZMHhFaTlIVXExDQpXb3Fkam9rdlNmUHlRTkxHL0hVWnVDOW5IWjBqMTRLeDhQRDUyVHFFckEvWHpJSlh1OWFKVWpNOGhYMkdGcHZ2DQpBRzVpQjdZRWhxaXpSZnM4VGNmc1BIeU81RVpTOFREVA0KLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQ0K
            service:
            name: pepr-e64f19bc-52ce-5472-9add-4a0b6080c360
            namespace: pepr-system
            path: >-
                /mutate/9cbbce8b676103fe4539a320e328a3ebad4aff662b058a0ae2090217f1ce57f8
        failurePolicy: Fail
        matchPolicy: Equivalent
        timeoutSeconds: 10
        namespaceSelector:
            matchExpressions:
            - key: pepr.dev
                operator: NotIn
                values:
                - ignore
            - key: kubernetes.io/metadata.name
                operator: NotIn
                values:
                - kube-system
                - pepr-system
        objectSelector:
            matchExpressions:
            - key: pepr.dev
                operator: NotIn
                values:
                - ignore
            - key: kubernetes.io/metadata.name
                operator: NotIn
                values:
                - kube-system
                - pepr-system
        rules:
            - apiGroups:
                - ''
            apiVersions:
                - v1
            operations:
                - CREATE
            resources:
                - namespaces
            - apiGroups:
                - ''
            apiVersions:
                - v1
            operations:
                - CREATE
            resources:
                - configmaps
            - apiGroups:
                - ''
            apiVersions:
                - v1
            operations:
                - CREATE
                - UPDATE
            resources:
                - configmaps
            - apiGroups:
                - ''
            apiVersions:
                - v1
            operations:
                - CREATE
            resources:
                - secrets
            - apiGroups:
                - pepr.dev
            apiVersions:
                - v1
            operations:
                - CREATE
            resources:
                - unicorns
        sideEffects: None
    `;
}

export function apiTokenSecret() {
  return `
      apiVersion: v1
      kind: Secret
      metadata:
        name: pepr-{{ .Values.uuid }}-api-token
        namespace: pepr-system
      type: Opaque
      data:
        value: >-
        {{ .Values.admission.annotations | nindent 4 }}
    `;
}

export function helmRoleBinding() {
  return `
      apiVersion: rbac.authorization.k8s.io/v1
      kind: RoleBinding
      metadata:
        name: pepr-{{ .Values.uuid }}-store
        namespace: pepr-system
      roleRef:
        apiGroup: rbac.authorization.k8s.io
        kind: Role
        name: pepr-{{ .Values.uuid }}-store
      subjects:
        - kind: ServiceAccount
          name: pepr-{{ .Values.uuid }}-store
          namespace: pepr-system
    `;
}

export function helmClusterRoleBinding() {
  return `
      apiVersion: rbac.authorization.k8s.io/v1
      kind: ClusterRoleBinding
      metadata:
        name: pepr-{{ .Values.uuid }}
      roleRef:
        apiGroup: rbac.authorization.k8s.io
        kind: ClusterRole
        name: pepr-{{ .Values.uuid }}
      subjects:
        - kind: ServiceAccount
          name: pepr-{{ .Values.uuid }}
          namespace: pepr-system
    `;
}
export function helmServiceAccount() {
  return `
      apiVersion: v1
      kind: ServiceAccount
      metadata:
        name: pepr-{{ .Values.uuid }}
        namespace: pepr-system
    `;
}
export function chartYaml(name: string, description?: string) {
  return `
      apiVersion: v2
      name: ${name}
      description: ${description || ""}
  
      # A chart can be either an 'application' or a 'library' chart.
      #
      # Application charts are a collection of templates that can be packaged into versioned archives
      # to be deployed.
      #
      # Library charts provide useful utilities or functions for the chart developer. They're included as
      # a dependency of application charts to inject those utilities and functions into the rendering
      # pipeline. Library charts do not define any templates and therefore cannot be deployed.
      type: application
  
      # This is the chart version. This version number should be incremented each time you make changes
      # to the chart and its templates, including the app version.
      # Versions are expected to follow Semantic Versioning (https://semver.org/)
      version: 0.1.0
  
      # This is the version number of the application being deployed. This version number should be
      # incremented each time you make changes to the application. Versions are not expected to
      # follow Semantic Versioning. They should reflect the version the application is using.
      # It is recommended to use it with quotes.
      appVersion: "1.16.0"
  
    `;
}

export function helmWatcherDeployment() {
  return `
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: pepr-{{ .Values.uuid }}-watcher
        namespace: pepr-system
        annotations:
          {{- toYaml .Values.admission.annotations | nindent 4 }}
        labels:
          {{- toYaml .Values.admission.labels | nindent 4 }}
      spec:
        replicas: 1
        strategy:
          type: Recreate
        selector:
          matchLabels:
            app: pepr-{{ .Values.uuid }}-watcher
            pepr.dev/controller: watcher
        template:
          metadata:
            labels:
              app: pepr-{{ .Values.uuid }}-watcher
              pepr.dev/controller: watcher
          spec:
            serviceAccountName: pepr-{{ .Values.uuid }}
            securityContext:
              {{- toYaml .Values.admission.securityContext | nindent 8 }}
            containers:
              - name: watcher
                image: {{ .Values.watcher.image }}
                imagePullPolicy: IfNotPresent
                command:
                  - node
                  - /app/node_modules/pepr/dist/controller.js
                  - {{ .Values.watcher.image }}
                readinessProbe:
                  httpGet:
                    path: /healthz
                    port: 3000
                    scheme: HTTPS
                livenessProbe:
                  httpGet:
                    path: /healthz
                    port: 3000
                    scheme: HTTPS
                ports:
                  - containerPort: 3000
                  resources:
                  {{- toYaml .Values.admission.resources | nindent 10 }}
                env:
                  {{- toYaml .Values.admission.env | nindent 10 }}
                securityContext:
                  {{- toYaml .Values.admission.containerSecurityContext | nindent 10 }}
                volumeMounts:
                  - name: tls-certs
                    mountPath: /etc/certs
                    readOnly: true
                  - name: module
                    mountPath: /app/load
                    readOnly: true
            volumes:
              - name: tls-certs
                secret:
                  secretName: pepr-{{ .Values.uuid }}-tls
              - name: module
                secret:
                  secretName: pepr-{{ .Values.uuid }}-module
    `;
}

export function helmAdmissionDeployment() {
  return `
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: pepr-{{ .Values.uuid }}
        namespace: pepr-system
        annotations:
          {{- toYaml .Values.admission.annotations | nindent 4 }}
        labels:
          {{- toYaml .Values.admission.labels | nindent 4 }}
      spec:
        replicas: 2
        selector:
          matchLabels:
            app: pepr-{{ .Values.uuid }}
            pepr.dev/controller: admission
        template:
          metadata:
            annotations:
              
            labels:
              app: pepr-{{ .Values.uuid }}
              pepr.dev/controller: admission
          spec:
            priorityClassName: system-node-critical
            serviceAccountName: pepr-{{ .Values.uuid }}
            securityContext:
              {{- toYaml .Values.admission.securityContext | nindent 8 }}
            containers:
              - name: server
                image: {{ .Values.admission.image }}
                imagePullPolicy: IfNotPresent
                command:
                  - node
                  - /app/node_modules/pepr/dist/controller.js
                  - {{ .Values.hash }}
                readinessProbe:
                  httpGet:
                    path: /healthz
                    port: 3000
                    scheme: HTTPS
                livenessProbe:
                  httpGet:
                    path: /healthz
                    port: 3000
                    scheme: HTTPS
                ports:
                  - containerPort: 3000
                resources:
                  {{- toYaml .Values.admission.resources | nindent 10 }}
                env:
                  {{- toYaml .Values.admission.env | nindent 10 }}
                securityContext:
                  {{- toYaml .Values.admission.containerSecurityContext | nindent 10 }}
                volumeMounts:
                  - name: tls-certs
                    mountPath: /etc/certs
                    readOnly: true
                  - name: api-token
                    mountPath: /app/api-token
                    readOnly: true
                  - name: module
                    mountPath: /app/load
                    readOnly: true
            volumes:
              - name: tls-certs
                secret:
                  secretName: pepr-{{ .Values.uuid }}-tls
              - name: api-token
                secret:
                  secretName: pepr-{{ .Values.uuid }}-api-token
              - name: module
                secret:
                  secretName: pepr-{{ .Values.uuid }}-module  
    `;
}
