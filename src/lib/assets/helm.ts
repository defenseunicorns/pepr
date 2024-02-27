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
export function admissionSVCTemplate() {
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
export function watcherSVCTemplate() {
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

export function watcherDeployTemplate() {
    return `
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: pepr-{{ .Values.uuid }}-watcher
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
            app: pepr-{{ .Values.uuid }}-watcher
            pepr.dev/controller: watcher
        template:
          metadata:
            annotations: 
              buildTimestamp: ${Date.now()}
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
                  {{- toYaml .Values.watcher.resources | nindent 12 }}
                env:
                  {{- toYaml .Values.watcher.env | nindent 12 }}
                securityContext:
                  {{- toYaml .Values.watcher.containerSecurityContext | nindent 12 }}
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

export function admissionDeployTemplate() {
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
              buildTimestamp: ${Date.now()}
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
                  {{- toYaml .Values.admission.resources | nindent 12 }}
                env:
                  {{- toYaml .Values.admission.env | nindent 12 }}
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
