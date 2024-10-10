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

export function chartYaml(name: string, description?: string) {
  return `
    apiVersion: v2
    name: ${name}
    description: ${description || ""}

    type: application
    version: 0.1.0
    appVersion: "1.16.0"
  `;
}

export function watcherDeployTemplate(buildTimestamp: string) {
  return `
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: {{ .Values.uuid }}-watcher
        namespace: pepr-system
        annotations:
          {{- toYaml .Values.watcher.annotations | nindent 4 }}
        labels:
          {{- toYaml .Values.watcher.labels | nindent 4 }}
      spec:
        replicas: 1
        strategy:
          type: Recreate
        selector:
          matchLabels:
            app: {{ .Values.uuid }}-watcher
            pepr.dev/controller: watcher
        template:
          metadata:
            annotations:
              buildTimestamp: "${buildTimestamp}"
              {{- if .Values.watcher.podAnnotations }}
              {{- toYaml .Values.watcher.podAnnotations | nindent 8 }}
              {{- end }}
            labels:
              app: {{ .Values.uuid }}-watcher
              pepr.dev/controller: watcher
          spec:
            terminationGracePeriodSeconds: {{ .Values.watcher.terminationGracePeriodSeconds }}
            serviceAccountName: {{ .Values.uuid }}
            securityContext:
              {{- toYaml .Values.admission.securityContext | nindent 8 }}
            containers:
              - name: watcher
                image: {{ .Values.watcher.image }}
                imagePullPolicy: IfNotPresent
                command:
                  - node
                  - /app/node_modules/pepr/dist/controller.js
                  - {{ .Values.hash }}
                readinessProbe:
                  {{- toYaml .Values.watcher.readinessProbe | nindent 12 }}
                livenessProbe:
                  {{- toYaml .Values.watcher.livenessProbe | nindent 12 }}
                ports:
                  - containerPort: 3000
                resources:
                  {{- toYaml .Values.watcher.resources | nindent 12 }}
                env:
                  {{- toYaml .Values.watcher.env | nindent 12 }}
                  - name: PEPR_WATCH_MODE
                    value: "true"
                envFrom:
                  {{- toYaml .Values.watcher.envFrom | nindent 12 }}
                securityContext:
                  {{- toYaml .Values.watcher.containerSecurityContext | nindent 12 }}
                volumeMounts:
                  - name: tls-certs
                    mountPath: /etc/certs
                    readOnly: true
                  - name: module
                    mountPath: /app/load
                    readOnly: true
                  {{- if .Values.watcher.extraVolumeMounts }}
                  {{- toYaml .Values.watcher.extraVolumeMounts | nindent 12 }}
                  {{- end }}
            volumes:
              - name: tls-certs
                secret:
                  secretName: {{ .Values.uuid }}-tls
              - name: module
                secret:
                  secretName: {{ .Values.uuid }}-module
              {{- if .Values.watcher.extraVolumes }}
              {{- toYaml .Values.watcher.extraVolumes | nindent 8 }}
              {{- end }}
    `;
}

export function admissionDeployTemplate(buildTimestamp: string) {
  return `
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: {{ .Values.uuid }}
        namespace: pepr-system
        annotations:
          {{- toYaml .Values.admission.annotations | nindent 4 }}
        labels:
          {{- toYaml .Values.admission.labels | nindent 4 }}
      spec:
        replicas: 2
        selector:
          matchLabels:
            app: {{ .Values.uuid }}
            pepr.dev/controller: admission
        template:
          metadata:
            annotations:
              buildTimestamp: "${buildTimestamp}"
              {{- if .Values.admission.podAnnotations }}
              {{- toYaml .Values.admission.podAnnotations | nindent 8 }}
              {{- end }}
            labels:
              app: {{ .Values.uuid }}
              pepr.dev/controller: admission
          spec:
            terminationGracePeriodSeconds: {{ .Values.admission.terminationGracePeriodSeconds }}
            priorityClassName: system-node-critical
            serviceAccountName: {{ .Values.uuid }}
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
                  {{- toYaml .Values.admission.readinessProbe | nindent 12 }}
                livenessProbe:
                  {{- toYaml .Values.admission.livenessProbe | nindent 12 }}
                ports:
                  - containerPort: 3000
                resources:
                  {{- toYaml .Values.admission.resources | nindent 12 }}
                env:
                  {{- toYaml .Values.admission.env | nindent 12 }}
                  - name: PEPR_WATCH_MODE
                    value: "false"
                envFrom:
                  {{- toYaml .Values.admission.envFrom | nindent 12 }}
                securityContext:
                  {{- toYaml .Values.admission.containerSecurityContext | nindent 12 }}
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
                  {{- if .Values.admission.extraVolumeMounts }}
                  {{- toYaml .Values.admission.extraVolumeMounts | nindent 12 }}
                  {{- end }}
            volumes:
              - name: tls-certs
                secret:
                  secretName: {{ .Values.uuid }}-tls
              - name: api-token
                secret:
                  secretName: {{ .Values.uuid }}-api-token
              - name: module
                secret:
                  secretName: {{ .Values.uuid }}-module
              {{- if .Values.admission.extraVolumes }}
              {{- toYaml .Values.admission.extraVolumes | nindent 8 }}
              {{- end }}
    `;
}

export interface ClusterRoleRule {
  apiGroups: string[];
  resources: string[];
  verbs: string[];
}

export interface RoleRule {
  apiGroups: string[];
  resources: string[];
  verbs: string[];
}

export function clusterRoleTemplate(customClusterRoleRules: ClusterRoleRule[]) {
  return `
    apiVersion: rbac.authorization.k8s.io/v1
    kind: ClusterRole
    metadata:
      name: pepr-custom-cluster-role
    rules:
      ${customClusterRoleRules
        .map(
          rule => `
      - apiGroups: ${JSON.stringify(rule.apiGroups)}
        resources: ${JSON.stringify(rule.resources)}
        verbs: ${JSON.stringify(rule.verbs)}
      `,
        )
        .join("")}
  `;
}

export function roleTemplate(customStoreRoleRules: RoleRule[]) {
  return `
    apiVersion: rbac.authorization.k8s.io/v1
    kind: Role
    metadata:
      name: pepr-custom-role
      namespace: pepr-system
    rules:
      ${customStoreRoleRules
        .map(
          rule => `
      - apiGroups: ${JSON.stringify(rule.apiGroups)}
        resources: ${JSON.stringify(rule.resources)}
        verbs: ${JSON.stringify(rule.verbs)}
      `,
        )
        .join("")}
  `;
}

export function clusterRoleBindingTemplate() {
  return `
    apiVersion: rbac.authorization.k8s.io/v1
    kind: ClusterRoleBinding
    metadata:
      name: pepr-custom-cluster-role-binding
    roleRef:
      apiGroup: rbac.authorization.k8s.io
      kind: ClusterRole
      name: pepr-custom-cluster-role
    subjects:
    - kind: ServiceAccount
      name: pepr-custom-service-account
      namespace: pepr-system
  `;
}

export function roleBindingTemplate() {
  return `
    apiVersion: rbac.authorization.k8s.io/v1
    kind: RoleBinding
    metadata:
      name: pepr-custom-role-binding
      namespace: pepr-system
    roleRef:
      apiGroup: rbac.authorization.k8s.io
      kind: Role
      name: pepr-custom-role
    subjects:
    - kind: ServiceAccount
      name: pepr-custom-service-account
      namespace: pepr-system
  `;
}

export function serviceMonitorTemplate(name: string) {
  return `
      {{- if .Values.${name}.serviceMonitor.enabled }}
      apiVersion: monitoring.coreos.com/v1
      kind: ServiceMonitor
      metadata:
        name: ${name}
        annotations:
          {{- toYaml .Values.${name}.serviceMonitor.annotations | nindent 4 }}
        labels:
          {{- toYaml .Values.${name}.serviceMonitor.labels | nindent 4 }}
      spec:
        selector:
          matchLabels:
            pepr.dev/controller: ${name}
        namespaceSelector:
          matchNames:
            - pepr-system
        endpoints:
          - targetPort: 3000
            scheme: https
            tlsConfig:
              insecureSkipVerify: true
      {{- end }}
    `;
}
