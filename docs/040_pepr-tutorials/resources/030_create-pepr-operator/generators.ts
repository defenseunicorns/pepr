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

// Generate a Service for a WebApp instance
export function service(instance: WebApp) {
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

// Generate a ConfigMap with themed and localized HTML content
export function configmap(instance: WebApp) {
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
