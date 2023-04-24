import { generateRandomPassword } from './util';
import { fetch  } from "pepr";
import { fetchRaw  } from 'pepr';

export { keycloakAPI };

class keycloakAPI {
  baseURL: string;
  connected: boolean;
  clientId: string;
  username: string;
  password: string;
  accessToken: string;

  constructor(baseURL: string, password: string, clientId: string) {
    this.baseURL = baseURL
    this.connected = false
    this.password = password
    this.clientId = clientId
    this.username = 'user'
  }

  private async connect() {
    if (this.connected == true) {
      return
    }

    interface TokenResponse {
      access_token: string
    }

    const tokenUrl = `${this.baseURL}/realms/master/protocol/openid-connect/token`;

    const requestData = {
      'grant_type': 'password',
      'client_id': 'admin-cli',
      'username': this.username,
      'password': this.password
    }

    try {
      const response = await fetch<TokenResponse>(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(requestData),
      });
      this.accessToken = response.access_token;
    } catch (err) {
      throw new Error(`Error obtaining access token: ${err}`)
    }
    this.connected = true
  }

  
  getHeaders() {
    return{
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.accessToken}`,
    }
  }

  async createUser(realmName: string, username: string, email: string, firstName: string, lastName: string): Promise<string> {
    try {
      this.connect()

      const response = await fetch(`${this.baseURL}/admin/realms/${realmName}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          username,
          email,
          firstName,
          lastName,
          enabled: true,
        }),
      });

      const users = await fetch(
        `${this.baseURL}/admin/realms/${realmName}/users?username=${encodeURIComponent(username)}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      const user = users[0];
      const userId = user.id;

      const password = generateRandomPassword(12);

      await fetch(
        `${this.baseURL}/admin/realms/${realmName}/users/${userId}/reset-password`,
        {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify({
            temporary: false,
            value: password,
          }),
        }
      );

      return password;
    } catch (err) {
      throw new Error(`Error creating user: ${err}`);
    }
  }

  // return true if found, false is not found, and throw an exception for other errors
  async getRealm(realmName: string): Promise<boolean> {
    try {
      // XXX: BDW: when we can catch the 404 Error we can use fetch() versus fetchRaw
      const response = await fetchRaw(`${this.baseURL}/admin/realms/${realmName}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.ok) {
        return true
      }

      if (response.status !== 404) {
        throw new Error(`Error checking for realm existence: ${response.statusText}`);
      }

    } catch (err) {
      throw new Error(err)
    }
    return false
  }

  async createOrGetKeycloakRealm(realmName: string) {
    try {
      await this.connect()
      const doesRealmExist = await this.getRealm(realmName)
      if (doesRealmExist) {
        return
      }

      const createRealmResponse = await fetch(`${this.baseURL}/admin/realms`, {
        method: 'POST',
        headers: this.getHeaders(),

        body: JSON.stringify({
          realm: realmName,
          enabled: true,
        }),
      });
    } catch (err) {
      throw new Error(err)
    }
  }

  async createOrGetClientSecret(
    realmName: string,
    clientId: string,
    clientName: string
  ): Promise<string> {
    try {
      this.connect()
      // XXX: BDW: cleanup use a <T>
      const getClientsResponse = await fetchRaw(`${this.baseURL}/admin/realms/${realmName}/clients`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!getClientsResponse.ok) {
        throw new Error(`Error getting clients: ${getClientsResponse.statusText}`);
      }

      const clients = await getClientsResponse.json();
      const existingClient = clients.find((client: any) => client.clientId === clientId);

      if (existingClient) {
        console.log(`Client '${clientName}' with client ID '${clientId}' already exists.`);

        if (existingClient.secret) {
          return existingClient.secret;
        } else {
          throw new Error(`Existing client is not a confidential client, no secret is available.`);
        }
      }

      const createClientResponse = await fetch(`${this.baseURL}/admin/realms/${realmName}/clients`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          clientId,
          name: clientName,
          enabled: true,
          protocol: 'openid-connect',
          publicClient: false, // Make this a confidential client
          clientAuthenticatorType: 'client-secret', // Use client secret for authentication
        }),
      });

      console.log(`Successfully created client '${clientName}' with client ID '${clientId}'`);

      const createdClientResponse = await fetch(
        `${this.baseURL}/admin/realms/${realmName}/clients?clientId=${encodeURIComponent(clientId)}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      const createdClient = createdClientResponse[0];

      interface valueInterface {
        value: string
      }
  
      const clientSecretResponse = await fetch<valueInterface>(
        `${this.baseURL}/admin/realms/${realmName}/clients/${createdClient.id}/client-secret`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      return clientSecretResponse.value;
    } catch (err) {
      throw new Error(err)
    }
  }



}
