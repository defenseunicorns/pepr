import { Capability, a } from "pepr";
import { V1ResourceRequirements, V1ConfigMap, CoreV1Api, KubeConfig } from '@kubernetes/client-node';
import fetch from 'node-fetch';

export const KeyCloakPepr = new Capability({
  name: "keycloakpepr",
  description: "Simple example to configure keycloak realm and clientid",
  namespaces: [],
});

// Use the 'When' function to create a new Capability Action
const { When } = KeyCloakPepr;

When(a.ConfigMap)
  .IsCreatedOrUpdated()
  .Then(async request => {
    const password = await getSecretValue("default", "keycloak", "admin-password")
    console.log(`secret is ${password}`)
    // LOLZ you cannot connect from the debuggging to a clusterip service :) 
    //const keycloakBaseUrl = "http://keycloak.default.svc.cluster.local"
    const keycloakBaseUrl = "http://localhost:9999"

    const token = await getKeycloakAccessToken(keycloakBaseUrl, "admin-cli", "user",password)
    console.log(`keycloak token is ${token}`)

    const realm = await createOrGetKeycloakRealm(keycloakBaseUrl,token,"yoda")
    console.log(`keycloak realm is ${realm}`)

    const clientId = "dagoba"
    const clientName = "swamp"
    const secret = await createOrGetClient(keycloakBaseUrl,token,realm,clientId,clientName)
    console.log(`keycloak client secret is ${secret}`)

  });

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
      console.log(`No data found for key '${key}' in the secret`);
      return undefined;
    }
  } catch (err) {
    console.error(`Error retrieving secret: ${err}`);
    return undefined;
  }
}

async function getKeycloakAccessToken(
  keycloakBaseUrl: string,
  clientId: string,
  username: string,
  password: string
): Promise<string | undefined> {
  const tokenUrl = `${keycloakBaseUrl}/realms/master/protocol/openid-connect/token`;

  const requestBody = new URLSearchParams();
  requestBody.append('grant_type', 'password');
  requestBody.append('client_id', clientId);
  requestBody.append('username', username);
  requestBody.append('password', password);

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody.toString(),
    });

    if (!response.ok) {
      console.error(`Error obtaining access token: ${response.statusText}`);
      return undefined;
    }

    const data = await response.json();
    const accessToken = data.access_token;
    return accessToken;
  } catch (err) {
    console.error(`Error obtaining access token: ${err}`);
    return undefined;
  }
}


async function createOrGetKeycloakRealm(keycloakBaseUrl: string, accessToken: string, realmName: string): Promise<string|undefined> {
  try {
    const getRealmResponse = await fetch(`${keycloakBaseUrl}/admin/realms/${realmName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (getRealmResponse.ok) {
      console.log(`Realm '${realmName}' already exists.`);
      return realmName;
    }

    if (getRealmResponse.status !== 404) {
      console.error(`Error checking for realm existence: ${getRealmResponse.statusText}`);
      return undefined;
    }

    const createRealmResponse = await fetch(`${keycloakBaseUrl}/admin/realms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        realm: realmName,
        enabled: true,
      }),
    });

    if (!createRealmResponse.ok) {
      console.error(`Error creating realm: ${createRealmResponse.statusText}`);
      return undefined;
    }

    console.log(`Successfully created realm '${realmName}'`);
    return realmName
  } catch (err) {
    console.error(`Error in createOrGetKeycloakRealm: ${err}`);
    return undefined
  }
}


async function createOrGetClient(
  keycloakBaseUrl: string,
  accessToken: string,
  realmName: string,
  clientId: string,
  clientName: string
): Promise<string | undefined> {
  try {
    const getClientsResponse = await fetch(`${keycloakBaseUrl}/admin/realms/${realmName}/clients`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!getClientsResponse.ok) {
      console.error(`Error getting clients: ${getClientsResponse.statusText}`);
      return;
    }

    const clients = await getClientsResponse.json();
    const existingClient = clients.find((client: any) => client.clientId === clientId);

    if (existingClient) {
      console.log(`Client '${clientName}' with client ID '${clientId}' already exists.`);

      if (existingClient.secret) {
        return existingClient.secret;
      } else {
        console.log(`Existing client is not a confidential client, no secret is available.`);
        return;
      }
    }

    const createClientResponse = await fetch(`${keycloakBaseUrl}/admin/realms/${realmName}/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        clientId,
        name: clientName,
        enabled: true,
        protocol: 'openid-connect',
        publicClient: false, // Make this a confidential client
        clientAuthenticatorType: 'client-secret', // Use client secret for authentication
      }),
    });

    if (!createClientResponse.ok) {
      console.error(`Error creating client: ${createClientResponse.statusText}`);
      return;
    }

    console.log(`Successfully created client '${clientName}' with client ID '${clientId}'`);

    const createdClientResponse = await fetch(
      `${keycloakBaseUrl}/admin/realms/${realmName}/clients?clientId=${encodeURIComponent(clientId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!createdClientResponse.ok) {
      console.error(`Error getting the created client: ${createdClientResponse.statusText}`);
      return;
    }

    const createdClients = await createdClientResponse.json();
    const createdClient = createdClients[0];

    const clientSecretResponse = await fetch(
      `${keycloakBaseUrl}/admin/realms/${realmName}/clients/${createdClient.id}/client-secret`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!clientSecretResponse.ok) {
      console.error(`Error getting client secret: ${clientSecretResponse.statusText}`);
      return;
    }

    const clientSecretData = await clientSecretResponse.json();
    const clientSecret = clientSecretData.value;
    console.log(`Client secret for '${clientName}' with client ID '${clientId}': ${clientSecret}`);
    return clientSecret;
  } catch (err) {
    console.error(`Error increateOrGetClient: ${err}`);
    return undefined;
  }
}
