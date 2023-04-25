// XXX:BDW TODO: will need to use fetch from Jeff, we didn't for this POC/pilot because some REST calls return nada in the body and response.json() does not like that :) 
import { generateRandomPassword } from './util';
import { fetch } from "pepr";
import { fetchRaw } from 'pepr';

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

    var { data, ok, status, statusText } = await fetch<TokenResponse>(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(requestData),
    });
    if (!ok) {
      throw new Error(`${status} ${statusText} from tokenUrl`)
    }
    this.accessToken = data.access_token;
    this.connected = true
  }


  getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.accessToken}`,
    }
  }

  async createUser(realmName: string, username: string, email: string, firstName: string, lastName: string): Promise<string> {
    try {
      await this.connect()
      /*
            // XXX: TODO Check the users for this realm
            const listUsersUrl = `${this.baseURL}/${realmName}/users`
            var {data, ok, status, statusText} = await fetch(listUsersUrl, {
              method: 'GET',
              headers: this.getHeaders()
            });
            
            if (!ok) {
              throw new Error(`${status} ${statusText} from ${listUsersUrl}`)
            }
      */

      // XXX: BDW: This will get a 409 conflict if the user exists.
      const createUserUrl = `${this.baseURL}/admin/realms/${realmName}/users`

      const requestData = {
        username: username,
        email: email,
        firstName: firstName,
        lastName: lastName,
        enabled: true,
      }



      var response = await fetchRaw(createUserUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText} from ${createUserUrl}`)
      }
      // XXX: BDW: check status, 


      /*
      var {data, ok, status, statusText } = await fetch(createUserUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestData),
      });

      
      if (!ok) {
        throw new Error(`${status} ${statusText} from ${createUserUrl}`)
      }
*/
      // XXX: BDW: add a <T>
      var response = await fetchRaw(
        `${this.baseURL}/admin/realms/${realmName}/users?username=${encodeURIComponent(username)}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText} from ${createUserUrl}`)
      }

      // XXX: BDW: TODO: deal with more than 1 user.
      const users = await response.json()
      const user = users[0];
      const userId = user.id;

      const password = generateRandomPassword(12);

      const setPasswordUrl = `${this.baseURL}/admin/realms/${realmName}/users/${userId}/reset-password`

      var response = await fetchRaw(
        setPasswordUrl,
        {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify({
            temporary: false,
            value: password,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText} from ${setPasswordUrl}`)
      }

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
    await this.connect()
    const doesRealmExist = await this.getRealm(realmName)
    if (doesRealmExist) {
      return
    }

    const createReamUrl = `${this.baseURL}/admin/realms`
    var response = await fetchRaw(createReamUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        realm: realmName,
        enabled: true,
      }),
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} from ${createReamUrl}`)
    }
  }

  async createOrGetClientSecret(
    realmName: string,
    clientId: string,
    clientName: string
  ): Promise<string> {
    try {
      await this.connect()
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

      var { data, ok } = await fetch<valueInterface>(
        `${this.baseURL}/admin/realms/${realmName}/clients/${createdClient.id}/client-secret`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      return data.value;
    } catch (err) {
      throw new Error(err)
    }
  }



}
