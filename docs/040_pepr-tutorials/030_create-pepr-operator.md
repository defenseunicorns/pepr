# Tutorial - Create an Operator in Pepr

## Introduction

This tutorial will walk you through the process of building a Kubernetes Operator in Pepr. If you get stuck, browse over to the [Pepr Excellent Examples](https://github.com/defenseunicorns/pepr-excellent-examples/tree/main/pepr-operator) to see the finished code.

## Background


The WebApp Operator deploys the WebApp `CustomResourceDefinition`, then watches and reconciles against instances of WebApps to ensure the desired state meets the actual cluster state.

The WebApp instance represents a `Deployment` object with configurable replicas, a `Service`, and a `ConfigMap` that has a `index.html` file that can be configured to a specific language, and theme. The resources the Operator deploys contain `ownerReferences`, causing a cascading delete effect when the WebApp instance is deleted.

If any object deployed by the Operator is deleted for any reason, the Operator will abruptly redeploy the object. 

## Steps

- [Create a new Pepr Module](#create-a-new-pepr-module)
- [Create CRD](#create-crd)
- [Create Helpers](#create-helpers)
- [Create Reconciler](#create-reconciler) 
- [Build and Deploy](#build-and-deploy)
 
## Create a new Pepr Module

```bash
npx pepr init

# output
✔ Enter a name for the new Pepr module. This will create a new directory based on the name.
 … operator
✔ (Recommended) Enter a description for the new Pepr module.
 … Kubernetes Controller for WebApp Resources
? How do you want Pepr to handle errors encountered during K8s operations? › - Use arrow-keys. Return to submit.
    Ignore
    Log an audit event
❯   Reject the operation - Pepr will reject the operation and return an error to the client.
```

## Create CRD

The WebApp CRD has the following properties: `theme`, `language`, and `replicas` with a `status` section used to track the status of the WebApp resource.

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: webapps.pepr.io
spec:
  group: pepr.io
  versions:
    - name: v1alpha1
      served: true
      storage: true
      subresources:
        status: {}
      schema:
        openAPIV3Schema:
          type: object
          properties:
            apiVersion:
              type: string
            kind:
              type: string
            metadata:
              type: object
            spec:
              required:
                - theme
                - language
                - replicas
              type: object
              properties:
                theme:
                  type: string
                  description: "Theme defines the theme of the web application, either dark or light."
                  enum:
                    - "dark"
                    - "light"
                language:
                  type: string
                  description: "Language defines the language of the web application, either English (en) or Spanish (es)."
                  enum:
                    - "en"
                    - "es"
                replicas:
                  type: integer
                  description: "Replicas is the number of desired replicas."
            status:
              type: object
              properties:
                observedGeneration:
                  type: integer
                phase:
                  type: string
                  enum:
                    - "Failed"
                    - "Pending"
                    - "Ready"
  scope: Namespaced
  names:
    plural: webapps
    singular: webapp
    kind: WebApp
    shortNames:
    - wa
```

Status should also be listed under `subresources` to make it writable. We provide descriptions under the properties for clarity around what the property is used for. Enums are useful to limit the values that can be used for a property.

Go to the `capabilities` directory, create a new directory called `crd` with two child folders, generated and source.

```bash
mkdir -p capabilities/crd/generated capabilities/crd/source  
```

Generate a class based on the WebApp CRD using `kubernetes-fluent-client`. This way we can react to the fields of the CRD in a type-safe way.

```bash
npx kubernetes-fluent-client crd https://gist.githubusercontent.com/cmwylie19/69b765af5ab25af62696f3337df13687/raw/72f53db7ddc06fc8891dc81136a7c190bc70f41b/WebApp.yaml . 
```

Change the first lines of the generated file to the following:

```typescript
import { a, RegisterKind } from "pepr";
export class WebApp extends a.GenericKind {
    spec?:       Spec;
    status?:     Status;
}
```

Move the updated file to `capabilities/crd/generated/webapp-v1alpha1.ts`.

In the `capabilities/crd/source` folder, create a file called `webapp.crd.ts` and add the following. This will have the controller automatically create the CRD when it starts.

```typescript
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
```

Add a `register.ts` file to the `capabilities/crd/` folder and add the following. This will auto register the CRD on startup.

```typescript
import { K8s, Log, kind } from "pepr";

import { WebAppCRD } from "./source/webapp.crd";

export const RegisterCRD = () => {
  K8s(kind.CustomResourceDefinition)
    .Apply(WebAppCRD, { force: true })
    .then(() => Log.info("WebApp CRD registered"))
    .catch(err => {
      Log.error(err);
      process.exit(1);
    });
};
(() => RegisterCRD())();
```

Finally add a `validate.ts` file to the `crd` folder and add the following. This will ensure that instances of the WebApp resource are in valid namespaces and have a maximum of 7 replicas.

```typescript
import { PeprValidateRequest } from "pepr";

import { WebApp } from "./generated/webapp-v1alpha1";

const invalidNamespaces = [
  "kube-system",
  "kube-public",
  "_unknown_",
  "pepr-system",
  "default",
];

export async function validator(req: PeprValidateRequest<WebApp>) {
  const ns = req.Raw.metadata?.namespace ?? "_unknown_";

  if (req.Raw.spec.replicas > 7) {
    return req.Deny("max replicas is 7 to prevent noisy neighbors");
  }
  if (invalidNamespaces.includes(ns)) {
    if (req.Raw.metadata?.namespace === "default") {
      return req.Deny("default namespace is not allowed");
    }
    return req.Deny("invalid namespace");
  }

  return req.Approve();
}
```

In this section we generated the CRD class for WebApp, created a function to auto register the CRD, and added a validator to validate that instances of WebApp are in valid namespaces and have a maximum of 7 replicas.

## Create Helpers

In this section we will create helper functions to help with the reconciliation process. The idea is that this operator will "remedy" any accidental deletions of the resources it creates. If any object deployed by the Operator is deleted for any reason, the Operator will automatically redeploy the object.

Create a `controller` folder in the `capabilities` folder and create a `generators.ts` file. This file will contain functions that generate Kubernetes Objects for the Operator to deploy (with the ownerReferences auto-included). Since these resources are owned by the WebApp resource, they will be deleted when the WebApp resource is deleted.

```typescript
import { kind, K8s, Log, sdk } from "pepr";
import { WebApp } from "../crd/generated/webapp-v1alpha1";

const { getOwnerRefFrom } = sdk;

export default async function Deploy(instance: WebApp) {
  try {
    await Promise.all([
      K8s(kind.Deployment).Apply(deployment(instance), {
        force: true,
      }),
      K8s(kind.Service).Apply(service(instance), { force: true }),
      K8s(kind.ConfigMap).Apply(configmap(instance), {
        force: true,
      }),
    ]);
  } catch (error) {
    Log.error(error, "Failed to apply Kubernetes manifests.");
  }
}

function deployment(instance: WebApp) {
  const { name, namespace } = instance.metadata!;
  const { replicas } = instance.spec!;

  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      ownerReferences: getOwnerRefFrom(instance),
      name,
      namespace,
      labels: {
        "pepr.dev/operator": name,
      },
    },
    spec: {
      replicas,
      selector: {
        matchLabels: {
          "pepr.dev/operator": name,
        },
      },
      template: {
        metadata: {
          ownerReferences: getOwnerRefFrom(instance),
          annotations: {
            buildTimestamp: `${Date.now()}`,
          },
          labels: {
            "pepr.dev/operator": name,
          },
        },
        spec: {
          containers: [
            {
              name: "server",
              image: "nginx:1.19.6-alpine",
              ports: [
                {
                  containerPort: 80,
                },
              ],
              volumeMounts: [
                {
                  name: "web-content-volume",
                  mountPath: "/usr/share/nginx/html",
                },
              ],
            },
          ],
          volumes: [
            {
              name: "web-content-volume",
              configMap: {
                name: `web-content-${name}`,
              },
            },
          ],
        },
      },
    },
  };
}

function service(instance: WebApp) {
  const { name, namespace } = instance.metadata!;
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      ownerReferences: getOwnerRefFrom(instance),
      name,
      namespace,
      labels: {
        "pepr.dev/operator": name,
      },
    },
    spec: {
      selector: {
        "pepr.dev/operator": name,
      },
      ports: [
        {
          protocol: "TCP",
          port: 80,
          targetPort: 80,
        },
      ],
      type: "ClusterIP",
    },
  };
}

function configmap(instance: WebApp) {
  const { name, namespace } = instance.metadata!;
  const { language, theme } = instance.spec!;

  const dark = `
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: #1a1a1a;
            color: #f5f5f5;
            text-align: center;
        }
        .top-panel {
            background: #333;
            color: #fff;
            padding: 10px 0;
            width: 100%;
            position: fixed;
            top: 0;
            left: 0;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        .top-panel img {
            height: 60px;
            vertical-align: middle;
            margin-right: 15px;
        }
        .top-panel h1 {
            display: inline;
            vertical-align: middle;
            font-size: 24px;
        }
        .container {
            max-width: 900px;
            background: #222;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            margin-top: 80px; /* Added margin-top to avoid overlap with the fixed top panel */
        }
        h2 {
            color: #b22222;
        }
        p {
            font-size: 18px;
            line-height: 1.6;
            text-align: left;
            color: #f5f5f5;
        }
        .section {
            margin-bottom: 20px;
        }
        .links {
            margin-top: 20px;
        }
        .links a {
            display: inline-block;
            margin-right: 15px;
            color: #006bee;
            text-decoration: none;
            font-weight: bold;
        }
        `;
  const light = `
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: #fff;
            color: #333;
            text-align: center;
        }
        .top-panel {
            background: #fbfbfb;
            color: #333;
            padding: 10px 0;
            width: 100%;
            position: fixed;
            top: 0;
            left: 0;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        .top-panel img {
            height: 60px;
            vertical-align: middle;
            margin-right: 15px;
        }
        .top-panel h1 {
            display: inline;
            vertical-align: middle;
            font-size: 24px;
        }
        .container {
            max-width: 900px;
            background: #fff;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            margin-top: 80px; /* Added margin-top to avoid overlap with the fixed top panel */
        }
        h2 {
            color: #b22222;
        }
        p {
            font-size: 18px;
            line-height: 1.6;
            text-align: left;
            color: #333;
        }
        .section {
            margin-bottom: 20px;
        }
        .links {
            margin-top: 20px;
        }
        .links a {
            display: inline-block;
            margin-right: 15px;
            color: #006bee;
            text-decoration: none;
            font-weight: bold;
        }
        `;
  const es = `
        <div class="top-panel">
        <img src="https://raw.githubusercontent.com/defenseunicorns/pepr/main/_images/pepr.png" alt="Pepr Logo">
        <h1>Pepr - Controlador De Kubernetes</h1>
        <img src="https://raw.githubusercontent.com/kubernetes/kubernetes/master/logo/logo.png" alt="Kubernetes Logo">
    </div>
    <div class="container">
        <div class="section">
            <h2>Sobre el proyecto</h2>
            <p>Nuestro controlador está diseñado para garantizar la seguridad, la eficiencia y la confiabilidad en la orquestación de tus contenedores. El Controlador de Admisión proporciona control y controles de seguridad rigurosos, mientras que el Operador simplifica operaciones complejas, haciendo que la administración sea muy sencilla.</p>
        </div>
        <div class="section">
            <h2>Características</h2>
            <p><strong>Controlador de Admisión :</strong>
            Verificaciones de cumplimiento automatizadas, aplicación de seguridad en tiempo real y integración perfecta con su canal de CI/CD.</p>
            <p><strong>Operador:</strong>Automatice tus aplicaciones de Kubernetes, optimice los procesos de implementación y habilite capacidades de autorreparación con nuestro sofisticado Operador.</p>
        </div>
        <div class="section">
            <h2>Hablanos!</h2>
            <p>Únate a nuestra comunidad y comience a contribuir hoy. Encuéntrenos en GitHub y únate a nuestro canal de Slack para conectarte con otros usuarios y contribuyentes.</p>
            <div class="links">
                <a href="https://github.com/defenseunicorns/pepr" target="_blank">GitHub Repository</a>
                <a href="https://kubernetes.slack.com/archives/C06DGH40UCB" target="_blank">Slack Channel</a>
            </div>
        </div>
    </div>
        `;

  const en = `
        <div class="top-panel">
        <img src="https://raw.githubusercontent.com/defenseunicorns/pepr/main/_images/pepr.png" alt="Pepr Logo">
        <h1>Pepr - Kubernetes Controller</h1>
        <img src="https://raw.githubusercontent.com/kubernetes/kubernetes/master/logo/logo.png" alt="Kubernetes Logo">
    </div>
    <div class="container">
        <div class="section">
            <h2>About the Project</h2>
            <p>Our Kubernetes Admission Controller and Operator are designed to ensure security, efficiency, and reliability in your container orchestration. The Admission Controller provides rigorous security checks and governance, while the Operator simplifies complex operations, making management a breeze.</p>
        </div>
        <div class="section">
            <h2>Features</h2>
            <p><strong>Admission Controller:</strong> Automated compliance checks, real-time security enforcement, and seamless integration with your CI/CD pipeline.</p>
            <p><strong>Operator:</strong> Automate your Kubernetes applications, streamline deployment processes, and enable self-healing capabilities with our sophisticated Operator.</p>
        </div>
        <div class="section">
            <h2>Get Involved</h2>
            <p>Join our community and start contributing today. Find us on GitHub and join our Slack channel to connect with other users and contributors.</p>
            <div class="links">
                <a href="https://github.com/defenseunicorns/pepr" target="_blank">GitHub Repository</a>
                <a href="https://kubernetes.slack.com/archives/C06DGH40UCB" target="_blank">Slack Channel</a>
            </div>
        </div>
    </div>
        `;

  const site = `
        <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Pepr</title>
        <style>
        ${theme === "light" ? light : dark}
        </style>
    </head>
    <body>
        ${language === "en" ? en : es}
    </body>
    </html>
        `;

  return {
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: {
      ownerReferences: getOwnerRefFrom(instance),
      name: `web-content-${name}`,
      namespace,
      labels: {
        "pepr.dev/operator": name,
      },
    },
    data: {
      "index.html": `${site}`,
    },
  };
}
```

Our job is to make the deployment of the WebApp simple. Instead of having to keep track of the versions and revisions of all of the Kubernetes Objects required for the WebApp, rolling pods and updating configMaps, the deployer now only needs to focus on the `WebApp` instance. The controller will reconcile instances of the operand (WebApp) against the actual cluster state to reach the desired state.

We decide which `ConfigMap` to deploy based on the language and theme specified in the WebApp resource and how many replicas to deploy based on the replicas specified in the WebApp resource.

## Create Reconciler

Now, create the function that reacts to changes across WebApp instances. This function will be called and put into a queue, guaranteeing ordered and synchronous processing of events, even when the system may be under heavy load.

In the base of the `capabilities` folder, create a `reconciler.ts` file and add the following:

```typescript
import { K8s, Log, sdk } from "pepr";
import Deploy from "./controller/generators";
import { Phase, Status, WebApp } from "./crd";

const { writeEvent } = sdk;

/**
 * The reconciler is called from the queue and is responsible for reconciling the state of the instance
 * with the cluster. This includes creating the namespace, network policies and virtual services.
 *
 * @param pkg the package to reconcile
 */
export async function reconciler(instance: WebApp) {
  if (!instance.metadata?.namespace) {
    Log.error(instance, `Invalid WebApp definition`);
    return;
  }

  const isPending = instance.status?.phase === Phase.Pending;
  const isCurrentGeneration =
    instance.metadata.generation === instance.status?.observedGeneration;

  if (isPending || isCurrentGeneration) {
    Log.debug(instance, `Skipping pending or completed instance`);
    return;
  }

  const { namespace, name } = instance.metadata;

  Log.debug(instance, `Processing instance ${namespace}/${name}`);

  // Configure the namespace and namespace-wide network policies
  try {
    await updateStatus(instance, { phase: Phase.Pending });

    await Deploy(instance);

    await updateStatus(instance, {
      phase: Phase.Ready,
      observedGeneration: instance.metadata.generation,
    });
  } catch (e) {
    Log.error(e, `Error configuring for ${namespace}/${name}`);
    void updateStatus(instance, {
      phase: Phase.Failed,
      observedGeneration: instance.metadata.generation,
    });
  }
}

/**
 * Updates the status of the instance
 *
 * @param instance The instance to update
 * @param status The new status
 */
async function updateStatus(instance: WebApp, status: Status) {

  await writeEvent(instance, {phase: status}, {
      eventType: "Normal",
      eventReason: "CreatedOrUpdate",
      reportingComponent: instance.kind,
      reportingInstance: instance.metadata.name,
  });

  await K8s(WebApp).PatchStatus({
    metadata: {
      name: instance.metadata!.name,
      namespace: instance.metadata!.namespace,
    },
    status,
  });
}
```

Finally create the `index.ts` file in the `capabilities` folder and add the following:

```typescript
import { Capability, a, Log } from "pepr";
import { WebApp } from "./crd";
import { validator } from "./crd/validator";
import { WebAppCRD } from "./crd/source/webapp.crd";
import { RegisterCRD } from "./crd/register";
import { reconciler } from "./reconciler";
import "./crd/register";
import Deploy from "./controller/generators";

export const WebAppController = new Capability({
  name: "webapp-controller",
  description: "A Kubernetes Operator that manages WebApps",
  namespaces: [],
});

const { When, Store } = WebAppController;

// When instance is created or updated, validate it and enqueue it for processing
When(WebApp)
  .IsCreatedOrUpdated()
  .Validate(validator)
  .Reconcile(async instance => {
    try {
      Store.setItem(instance.metadata.name, JSON.stringify(instance));
      await reconciler(instance);
    } catch (error) {
      Log.info(`Error reconciling instance of WebApp`);
    }
  });

// Remove the instance from the store BEFORE it is deleted so reconcile stops 
// and a cascading deletion occurs for all owned resources.
// To make this work, we extended the timeout on the WebHook Configuration
When(WebApp)
  .IsDeleted()
  .Mutate(async instance => {
    await Store.removeItemAndWait(instance.Raw.metadata.name);
  });

// Don't let the CRD get deleted
When(a.CustomResourceDefinition)
  .IsDeleted()
  .WithName(WebAppCRD.metadata.name)
  .Watch(() => {
    RegisterCRD();
  });

// // Don't let them be deleted
When(a.Deployment)
  .IsDeleted()
  .WithLabel("pepr.dev/operator")
  .Watch(async deploy => {
    const instance = JSON.parse(
      Store.getItem(deploy.metadata!.labels["pepr.dev/operator"]),
    ) as a.GenericKind;
    await Deploy(instance);
  });
When(a.Service)
  .IsDeleted()
  .WithLabel("pepr.dev/operator")
  .Watch(async svc => {
    const instance = JSON.parse(
      Store.getItem(svc.metadata!.labels["pepr.dev/operator"]),
    ) as a.GenericKind;
    await Deploy(instance);
  });
When(a.ConfigMap)
  .IsDeleted()
  .WithLabel("pepr.dev/operator")
  .Watch(async cm => {
    const instance = JSON.parse(
      Store.getItem(cm.metadata!.labels["pepr.dev/operator"]),
    ) as a.GenericKind;
    await Deploy(instance);
  });

```
- When a WebApp is created or updated, validate it, store the name of the instance and enqueue it for processing.
- If an "owned" resource (ConfigMap, Service, or Deployment) is deleted, redeploy it.
- Always redeploy the WebApp CRD if it was deleted as the controller depends on it

In this section we created a `reconciler.ts` file that contains the function that is responsible for reconciling the state of the instance with the cluster based on CustomResource and updating the status of the instance. The `index.ts` file that contains the WebAppController capability and the functions that are used to watch for changes to the WebApp resource and corresponding Kubernetes resources. The `Reconcile` action processes the callback in a queue guaranteeing ordered and synchronous processing of events

## Demo

_Create an ephemeral cluster. (Kind or k3d will work)_

Clone the Operator

```bash
git clone https://github.com/defenseunicorns/pepr-excellent-examples.git
cd pepr-operator
```

Make sure Pepr is update to date

```bash
npx pepr update
```

Build the Pepr manifests (Already built with appropriate RBAC)

```bash
npx pepr build
```

Deploy the Operator 

```bash
kubectl apply -f dist/pepr-module-774fab07-77fa-517c-b5f8-c682c96c20c0.yaml
kubectl wait --for=condition=Ready pods -l app -n pepr-system --timeout=120s
```

Notice that the WebApp CRD has been deployed

```bash
kubectl get crd | grep webapp
```

Explain the `WebApp.spec`

```bash
kubectl explain wa.spec

# output
GROUP:      pepr.io
KIND:       WebApp
VERSION:    v1alpha1

FIELD: spec <Object>

DESCRIPTION:
    <empty>
FIELDS:
  language      <string> -required-
    Language defines the language of the web application, either English (en) or
    Spanish (es).

  replicas      <integer> -required-
    Replicas is the number of desired replicas.

  theme <string> -required-
    Theme defines the theme of the web application, either dark or light.
```

Create an instance of a `WebApp` in English with the light theme and 1 replica

```yaml
kubectl create ns webapps;
kubectl apply -f -<<EOF
kind: WebApp
apiVersion: pepr.io/v1alpha1
metadata:
  name: webapp-light-en
  namespace: webapps
spec:
  theme: light 
  language: en
  replicas: 1 
EOF
```

Check that the `ConfigMap`, `Service` and `Deployment` are deployed

```bash
kubectl get cm,svc,deploy -n webapps

# output
NAME                                    DATA   AGE
configmap/kube-root-ca.crt              1      6s
configmap/web-content-webapp-light-en   1      5s

NAME                      TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)   AGE
service/webapp-light-en   ClusterIP   10.43.85.1   <none>        80/TCP    5s

NAME                              READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/webapp-light-en   1/1     1            1           5s
```

Get the Status of the WebApp

```json
kubectl get wa webapp-light-en -n webapps -ojsonpath="{.status}" | jq  

# output
{
  "observedGeneration": 1,
  "phase": "Ready"
}
```

Describe the WebApp to look at events

```bash
kubectl describe wa webapp-light-en -n webapps
# output
Name:         webapp-light-en
Namespace:    webapps
API Version:  pepr.io/v1alpha1
Kind:         WebApp
Metadata: ...
Spec:
  Language:  en
  Replicas:  1
  Theme:     light
Status:
  Observed Generation:  1
  Phase:                Ready
Events:
  Type    Reason                    Age   From             Message
  ----    ------                    ----  ----             -------
  Normal  InstanceCreatedOrUpdated  36s   webapp-light-en  Pending
  Normal  InstanceCreatedOrUpdated  36s   webapp-light-en  Ready

```

Port-forward and look at the WebApp in the browser

```bash
kubectl port-forward svc/webapp-light-en -n webapps 3000:80
```
[WebApp](http://localhost:3000)
![WebApp](light.png)

Delete the `ConfigMap` on the WebApp to watch it the operator reconcile it back

```bash
kubectl delete cm -n webapps --all 
# wait a few seconds
kubectl get cm -n webapps 

# output
configmap "kube-root-ca.crt" deleted
configmap "web-content-webapp-light-en" deleted
NAME                          DATA   AGE
kube-root-ca.crt              1      0s
web-content-webapp-light-en   1      0s
```

Update the `WebApp` and change the theme to dark and language to spanish

```bash
kubectl apply -f -<<EOF
kind: WebApp
apiVersion: pepr.io/v1alpha1
metadata:
  name: webapp-light-en
  namespace: webapps
spec:
  theme: dark 
  language: es
  replicas: 1 
EOF
#output
webapp.pepr.io/webapp-light-en configured
```

Port-forward and look at the WebApp in the browser

```bash
kubectl port-forward svc/webapp-light-en -n webapps 3000:80
```
[WebApp](http://localhost:3000)

![WebApp](dark.png)

Delete the WebApp and check the namespace

```bash
kubectl delete wa -n webapps --all
# wait a few seconds
kubectl get cm,deploy,svc -n webapps
# output
NAME                         DATA   AGE
configmap/kube-root-ca.crt   1      40s
```

When the WebApp is deleted, all of the resources that it created are also deleted.


## Conclusion

In this tutorial we created a Kubernetes Operator using Pepr. We created a CRD, created helper functions to help with the reconciliation process, and created a queue and reconciler to reconcile the state of the instance with the cluster. We also built and deployed the Operator and created an instance of the WebApp resource and watched the Operator reconcile the state of the instance with the cluster. Finally, we updated and deleted the instance and watched the Operator reconcile the manifests based in the updated instance and delete the resources when the instance was deleted.

If you have questions, reach out in the [Slack channel](https://kubernetes.slack.com/archives/C06DGH40UCB) or [GitHub](https://github.com/defenseunicorns/pepr). Also, checkout the finished example in [Pepr Excellent Examples](https://github.com/defenseunicorns/pepr-excellent-examples/tree/main/pepr-operator)
