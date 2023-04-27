import { CoreV1Api, KubeConfig, V1Secret } from "@kubernetes/client-node";

export class K8sAPI {
  k8sApi: CoreV1Api;

  constructor() {
    const kc = new KubeConfig();
    kc.loadFromDefault();
    this.k8sApi = kc.makeApiClient(CoreV1Api);
  }

  async getSecretValue(
    namespace: string,
    secretName: string,
    key: string
  ): Promise<string | undefined> {
    const response = await this.k8sApi.readNamespacedSecret(
      secretName,
      namespace
    );
    const secret = response.body.data;

    if (secret && secret[key]) {
      // Decode the base64 encoded secret value
      const decodedValue = Buffer.from(secret[key], "base64").toString("utf-8");
      return decodedValue;
    }
    console.log(`Could not find key '${key}' in the secret ${secretName}`);
    return undefined;
  }

  async createKubernetesSecret(
    namespace: string,
    secretName: string,
    username: string,
    password: string
  ): Promise<void> {
    const secretManifest: V1Secret = {
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: secretName,
        namespace: namespace,
      },
      type: "Opaque",
      data: {
        username: Buffer.from(username).toString("base64"),
        password: Buffer.from(password).toString("base64"),
      },
    };
    await this.k8sApi.createNamespacedSecret(namespace, secretManifest);
    console.log(
      `Successfully created secret '${secretName}' in namespace '${namespace}'`
    );
  }

  async createKubernetesClientSecret(
    namespace: string,
    secretName: string,
    realmname: string,
    clientid: string,
    clientname: string,
    secret: string
  ) {
    const secretManifest: V1Secret = {
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: secretName,
        namespace: namespace,
        labels: {
          clientsecret: "true",
        },
      },
      type: "Opaque",
      data: {
        realmname: Buffer.from(realmname).toString("base64"),
        clientid: Buffer.from(clientid).toString("base64"),
        clientname: Buffer.from(clientname).toString("base64"),
        secret: Buffer.from(secret).toString("base64"),
      },
    };

    await this.k8sApi.createNamespacedSecret(namespace, secretManifest);
  }
}
