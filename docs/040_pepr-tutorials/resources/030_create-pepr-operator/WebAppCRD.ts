export const WebAppCRD = {
  apiVersion: "apiextensions.k8s.io/v1",
  kind: "CustomResourceDefinition",
  metadata: {
    name: "webapps.pepr.io",
  },
  spec: {
    group: "pepr.io",
    versions: [
      {
        name: "v1alpha1",
        served: true,
        storage: true,
        subresources: {
          status: {},
        },
        schema: {
          openAPIV3Schema: {
            type: "object",
            properties: {
              apiVersion: {
                type: "string",
              },
              kind: {
                type: "string",
              },
              metadata: {
                type: "object",
              },
              spec: {
                type: "object",
                properties: {
                  theme: {
                    type: "string",
                    enum: ["dark", "light"],
                    description:
                      "Theme defines the theme of the web application, either dark or light.",
                  },
                  language: {
                    type: "string",
                    enum: ["en", "es"],
                    description:
                      "Language defines the language of the web application, either English (en) or Spanish (es).",
                  },
                  replicas: {
                    type: "integer",
                    description: "Replicas is the number of desired replicas.",
                  },
                },
                required: ["theme", "language", "replicas"],
              },
              status: {
                type: "object",
                properties: {
                  observedGeneration: {
                    type: "integer",
                  },
                  phase: {
                    type: "string",
                    enum: ["Failed", "Pending", "Ready"],
                  },
                },
              },
            },
          },
        },
      },
    ],
    scope: "Namespaced",
    names: {
      plural: "webapps",
      singular: "webapp",
      kind: "WebApp",
      shortNames: ["wa"],
    },
  },
};
