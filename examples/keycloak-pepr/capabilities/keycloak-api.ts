import { generateRandomPassword } from './util';
import { fetch } from "pepr";
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

  // makes the connection to the keycloak API and gets an accessToken
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


  // return the tokenized headers
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.accessToken}`,
    }
  }

  // 
  async createUser(realmName: string, username: string, email: string, firstName: string, lastName: string): Promise<string> {
    await this.connect()

    var userId = await this.getUser(realmName, username);
    if (userId == undefined) {

      // XXX: BDW: This will get a 409 conflict if the user exists.
      const createUserUrl = `${this.baseURL}/admin/realms/${realmName}/users`

      const requestData = {
        username: username,
        email: email,
        firstName: firstName,
        lastName: lastName,
        enabled: true,
      }
      var { data, ok, status, statusText } = await fetch(
        createUserUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestData),
      });

      if (!ok) {
        throw new Error(`${status} ${statusText} from ${createUserUrl}`)
      }

      var userId = await this.getUser(realmName, username);

      // XXXX: BDW maybe not necesaary
      if (userId === undefined) {
        throw new Error(`failed to find the user created for ${username}`)
      }
      return userId
    }

    // If we're getting an update on the user, it will regenerate their password
    // likely we want to only do this for a new user....
    const password = generateRandomPassword(12);

    const setPasswordUrl = `${this.baseURL}/admin/realms/${realmName}/users/${userId}/reset-password`

    var { data, ok, status, statusText } = await fetch(
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

    if (!ok) {
      throw new Error(`${status} ${statusText} from ${setPasswordUrl}`)
    }
    return password;

  }

  private async getUser(realmName: string, username: string): Promise<string | undefined> {
    interface usersResponse {
      id: string
    }
    const getUserUrl = `${this.baseURL}/admin/realms/${realmName}/users?username=${encodeURIComponent(username)}`;
    const { data, ok, status, statusText } = await fetch<usersResponse[]>(
      getUserUrl,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    if (!ok) {
      throw new Error(`${status} ${statusText} from ${getUserUrl}`);
    }

    if (data.length === 0) {
      return undefined
    }

    if (data.length !== 1) {
      throw new Error(`Too many usersIds for user ${username} in realm ${realmName}`);
    }

    return data[0].id
  }


  // return true if found, false is not found, and throw an exception for other errors
  async getRealm(realmName: string): Promise<boolean> {
    const { data, ok, status, statusText } = await fetch(
      `${this.baseURL}/admin/realms/${realmName}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (ok) {
      return true
    }
    if (status !== 404) {
      throw new Error(`Error checking for realm existence: ${statusText}`);
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
    const { data, ok, status, statusText } = await fetch(
      createReamUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        realm: realmName,
        enabled: true,
      }),
    });
    if (!ok) {
      throw new Error(`${status} ${statusText} from ${createReamUrl}`)
    }
  }

  async getClientSecret(realmName: string, clientId: string): Promise<string> {
    interface clientIdInterface {
      secret: string
    }

    const getClientIdUrl = `${this.baseURL}/admin/realms/${realmName}/clients?clientId=${clientId}`
    var { data, ok, status, statusText } = await fetch<clientIdInterface[]>(
      getClientIdUrl, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!ok) {
      throw new Error(`Error getting clients for clientId ${clientId}: ${status} ${statusText}`);
    }

    if (data.length > 1) {
      throw new Error(`more than one client with the id ${clientId}`);
    }

    if (data.length == 1) {
      console.log(`Client ID '${clientId}' already exists.`);
      if (data[0].secret) {
        return data[0].secret;
      } else {
        throw new Error(`Existing client '${clientId}' is not a confidential client, no secret is available.`);
      }
    }
  }

  async createOrGetClientSecret(
    realmName: string,
    clientId: string,
    clientName: string
  ): Promise<string> {
    await this.connect()

    // if the client secret already exists, return it.
    var secret = await this.getClientSecret(realmName, clientId)
    if (secret !== undefined) {
      return secret
    }

    const createClientUrl = `${this.baseURL}/admin/realms/${realmName}/clients`
    const {data, ok, status, statusText} = await fetch(
      createClientUrl, {
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
    if (!ok) {
      throw new Error(`${status} ${statusText} from ${createClientUrl}`)
    }

    secret = await this.getClientSecret(realmName, clientId)
    if (secret === undefined) {
      throw new Error(`Could not find secret for the ${clientName} and id ${clientId}`)
    }

    console.log(`Successfully created client '${clientName}' with client ID '${clientId}'`);


    return secret;
  }
}
