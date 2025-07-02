// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

type ControllerType = "admission" | "watcher";

export function clusterRoleTemplate(): string {
  return `
    apiVersion: rbac.authorization.k8s.io/v1
    kind: ClusterRole
    metadata:
      name: {{ .Values.uuid }}
      namespace: pepr-system
    rules: 
      {{- if .Values.rbac }}
      {{- toYaml .Values.rbac | nindent 2 }}
      {{- end }}
  `;
}

export function namespaceTemplate(): string {
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

export function chartYaml(name: string, description?: string): string {
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

export function watcherDeployTemplate(buildTimestamp: string, type: ControllerType): string {
  return `
      {{- if .Values.${type}.enabled }}
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
              {{- toYaml .Values.watcher.securityContext | nindent 8 }}
            nodeSelector:
              {{- toYaml .Values.watcher.nodeSelector | nindent 8 }}
            tolerations:
              {{- toYaml .Values.watcher.tolerations | nindent 8 }}
            affinity:
              {{- toYaml .Values.watcher.affinity | nindent 8 }}
            containers:
              - name: watcher
                image: {{ .Values.watcher.image }}
                imagePullPolicy: IfNotPresent
                {{- if gt (len .Values.imagePullSecrets) 0 }}
                imagePullSecrets:
                  {{- range .Values.imagePullSecrets }}
                  - name: {{ . }}
                  {{- end }}
                {{- end }}
                args:
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
                  {{- if .Values.additionalIgnoredNamespaces }}
                  - name: PEPR_ADDITIONAL_IGNORED_NAMESPACES
                    value: "{{ join ", " .Values.additionalIgnoredNamespaces }}"
                  {{- end }}
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
      {{- end }}
    `;
}

export function admissionDeployTemplate(buildTimestamp: string, type: ControllerType): string {
  return `
      {{- if .Values.${type}.enabled }}
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
            {{- if or .Values.admission.antiAffinity .Values.admission.affinity }}
            affinity:
            {{- if .Values.admission.antiAffinity }}
              podAntiAffinity:
                requiredDuringSchedulingIgnoredDuringExecution:
                  - labelSelector:
                      matchExpressions:
                        - key: pepr.dev/controller
                          operator: In
                          values:
                            - admission
                    topologyKey: "kubernetes.io/hostname"
            {{- end }}
            {{- if .Values.admission.affinity }}
              {{- toYaml .Values.admission.affinity | nindent 8 }}
            {{- end }}
            {{- end }}
            nodeSelector:
              {{- toYaml .Values.admission.nodeSelector | nindent 8 }}
            tolerations:
              {{- toYaml .Values.admission.tolerations | nindent 8 }}
            terminationGracePeriodSeconds: {{ .Values.admission.terminationGracePeriodSeconds }}
            priorityClassName: system-node-critical
            serviceAccountName: {{ .Values.uuid }}
            securityContext:
              {{- toYaml .Values.admission.securityContext | nindent 8 }}
            containers:
              - name: server
                image: {{ .Values.admission.image }}
                imagePullPolicy: IfNotPresent
                {{- if gt (len .Values.imagePullSecrets) 0 }}
                imagePullSecrets:
                  {{- range .Values.imagePullSecrets }}
                  - name: {{ . }}
                  {{- end }}
                {{- end }}
                args:
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
                  {{- if .Values.additionalIgnoredNamespaces }}
                  - name: PEPR_ADDITIONAL_IGNORED_NAMESPACES
                    value: "{{ join ", " .Values.additionalIgnoredNamespaces }}"
                  {{- end }}
                envFrom:
                  {{- toYaml .Values.admission.envFrom | nindent 12 }}
                securityContext:
                  {{- toYaml .Values.admission.containerSecurityContext | nindent 12 }}
                volumeMounts:
                  - name: tls-certs
                    mountPath: /etc/certs
                    readOnly: true
                  - name: api-path
                    mountPath: /app/api-path
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
              - name: api-path
                secret:
                  secretName: {{ .Values.uuid }}-api-path
              - name: module
                secret:
                  secretName: {{ .Values.uuid }}-module  
              {{- if .Values.admission.extraVolumes }}
              {{- toYaml .Values.admission.extraVolumes | nindent 8 }}
              {{- end }}
      {{- end }}
    `;
}

export function serviceMonitorTemplate(name: string, type: ControllerType): string {
  return `
      {{- if .Values.${type}.serviceMonitor.enabled }}
      apiVersion: monitoring.coreos.com/v1
      kind: ServiceMonitor
      metadata:
        name: ${name}
        namespace: pepr-system
        annotations:
          {{- toYaml .Values.${type}.serviceMonitor.annotations | nindent 4 }}
        labels:
          {{- toYaml .Values.${type}.serviceMonitor.labels | nindent 4 }}
      spec:
        selector:
          matchLabels:
            pepr.dev/controller: ${type}
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

export function serviceTemplate(name: string, type: ControllerType): string {
  const svcName = type === "admission" ? name : `${name}-${type}`;
  return `
      {{- if .Values.${type}.enabled }}
      apiVersion: v1
      kind: Service
      metadata:
        name: ${svcName}
        namespace: pepr-system
        labels:
          pepr.dev/controller: ${type}
      spec:
        selector:
          app: ${svcName}
          pepr.dev/controller: ${type}
        ports:
        - port: 443
          targetPort: 3000
      {{- end }}
    `;
}
