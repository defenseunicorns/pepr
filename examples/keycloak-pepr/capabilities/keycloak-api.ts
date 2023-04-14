import fetch from 'node-fetch';
import { generateRandomPassword } from './util';
import { getSecretValue } from './kubernetes-api';

export { getKeycloakAccessToken, createOrGetKeycloakRealm, createOrGetClient, createUser  };



async function createUser(
  keycloakBaseUrl: string,
  accessToken: string,
  realmName: string,
  username: string,
  email: string,
  firstName: string,
  lastName: string
): Promise<string | undefined> {
  try {
    const response = await fetch(`${keycloakBaseUrl}/admin/realms/${realmName}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        username,
        email,
        firstName,
        lastName,
        enabled: true,
      }),
    });

    if (!response.ok) {
      console.error(`Error creating user: ${response.statusText}`);
      return;
    }

    console.log(`Successfully created user '${username}'`);

    const userIdResponse = await fetch(
      `${keycloakBaseUrl}/admin/realms/${realmName}/users?username=${encodeURIComponent(username)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!userIdResponse.ok) {
      console.error(`Error getting user ID: ${userIdResponse.statusText}`);
      return;
    }

    const users = await userIdResponse.json();
    const user = users[0];
    const userId = user.id;

    const password = generateRandomPassword(12);

    const setPasswordResponse = await fetch(
      `${keycloakBaseUrl}/admin/realms/${realmName}/users/${userId}/reset-password`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          temporary: false,
          value: password,
        }),
      }
    );

    if (!setPasswordResponse.ok) {
      console.error(`Error setting user password: ${setPasswordResponse.statusText}`);
      return;
    }

    console.log(`Successfully set password for user '${username}'`);
    return password;
  } catch (err) {
    console.error(`Error creating user: ${err}`);
    return undefined;
  }
}



async function getKeycloakAccessToken(
  keycloakBaseUrl: string,
  clientId: string,
  username: string,
  namespace: string,
  secretName: string
): Promise<string | undefined> {

  const password = await getSecretValue(namespace, secretName, "admin-password")

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




