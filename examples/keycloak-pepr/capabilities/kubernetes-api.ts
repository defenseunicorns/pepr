import { V1ResourceRequirements, V1ConfigMap, CoreV1Api, KubeConfig , V1Secret } from '@kubernetes/client-node';

export { getSecretValue, createKubernetesSecret }



async function getSecretValue(namespace: string, secretName: string, key: string): Promise<string | undefined> {
    const kc = new KubeConfig();
    kc.loadFromDefault();
  
    const k8sApi = kc.makeApiClient(CoreV1Api);
  
    try {
      // Retrieve the secret
      const response = await k8sApi.readNamespacedSecret(secretName, namespace);
      const secret = response.body;
  
      if (secret.data && secret.data[key]) {
        // Decode the base64 encoded secret value
        const decodedValue = Buffer.from(secret.data[key], 'base64').toString('utf-8');
        return decodedValue;
      } else {
        console.log(`Could not find key '${key}' in the secret`);
        return undefined;
      }
    } catch (err) {
      console.error(`Error retrieving secret: ${err}`);
      return undefined;
    }
  }
  

  async function createKubernetesSecret(
    namespace: string,
    secretName: string,
    username: string,
    password: string
  ): Promise<void> {
    const kc = new KubeConfig();
    kc.loadFromDefault();  
    const k8sApi = kc.makeApiClient(CoreV1Api);
  
    const secretManifest: V1Secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: secretName,
        namespace: namespace,
      },
      type: 'Opaque',
      data: {
        username: Buffer.from(username).toString('base64'),
        password: Buffer.from(password).toString('base64'),
      },
    };
  
    try {
      await k8sApi.createNamespacedSecret(namespace, secretManifest);
      console.log(`Successfully created secret '${secretName}' in namespace '${namespace}'`);
    } catch (err) {
      console.error(`Error creating secret: ${err.body.message}`);
    }
  }