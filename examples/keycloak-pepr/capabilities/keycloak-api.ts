import { HeadersInit } from "node-fetch";
import { Log, fetch, fetchStatus } from "pepr";
import { generatePassword } from "./util";

interface TokenResponse {
  access_token: string;
}

interface usersResponse {
  id: string;
}

interface clientIdInterface {
  secret: string;
}

export class KeycloakAPI {
  headers: HeadersInit;
  connected = false;
  username = "user";

  constructor(
    private readonly baseURL: string,
    private readonly password: string,
    private readonly clientId: string
  ) {}

  /**
   * makes the connection to the keycloak API and gets an accessToken
   *
   * @returns void
   */
  private async connect() {
    // If we're already connected, do nothing
    if (this.connected) {
      return;
    }

    const url = `${this.baseURL}/realms/master/protocol/openid-connect/token`;
    const body = {
      grant_type: "password",
      client_id: "admin-cli",
      username: this.username,
      password: this.password,
    };

    const { data, ok, status, statusText } = await fetch<TokenResponse>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body),
    });

    if (!ok) {
      throw new Error(`${status} ${statusText} from tokenUrl`);
    }

    // Set the headers for future requests
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.access_token}`,
    };

    // Mark the connection as established
    this.connected = true;
  }

  async createUser(
    realmName: string,
    username: string,
    email: string,
    firstName: string,
    lastName: string
  ): Promise<string> {
    await this.connect();

    let userId = await this.getUser(realmName, username);
    if (userId == undefined) {
      // XXX: BDW: This will get a 409 conflict if the user exists.
      const url = `${this.baseURL}/admin/realms/${realmName}/users`;
      const body = {
        username: username,
        email: email,
        firstName: firstName,
        lastName: lastName,
        enabled: true,
      };

      const { ok, status, statusText } = await fetch(url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body),
      });

      if (!ok) {
        throw new Error(`${status} ${statusText} from ${url}`);
      }

      userId = await this.getUser(realmName, username);

      // XXXX: BDW maybe not necessary
      if (userId === undefined) {
        throw new Error(`failed to find the user created for ${username}`);
      }

      return userId;
    }

    // If we're getting an update on the user, it will regenerate their password
    // likely we want to only do this for a new user....
    const password = generatePassword(12);

    const url = `${this.baseURL}/admin/realms/${realmName}/users/${userId}/reset-password`;
    const body = {
      temporary: false,
      value: password,
    };

    const { ok, status, statusText } = await fetch(url, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!ok) {
      throw new Error(`${status} ${statusText} from ${url}`);
    }

    return password;
  }

  private async getUser(
    realmName: string,
    username: string
  ): Promise<string | undefined> {
    const encodedUsername = encodeURIComponent(username);
    const url = `${this.baseURL}/admin/realms/${realmName}/users?username=${encodedUsername}`;

    const { data, ok, status, statusText } = await fetch<usersResponse[]>(url, {
      method: "GET",
      headers: this.headers,
    });

    if (!ok) {
      throw new Error(`${status} ${statusText} from ${url}`);
    }

    if (data.length === 0) {
      return undefined;
    }

    if (data.length !== 1) {
      throw new Error(
        `Too many usersIds for user ${username} in realm ${realmName}`
      );
    }

    return data[0].id;
  }

  // return true if found, false is not found, and throw an exception for other errors
  async getRealm(realmName: string) {
    const url = `${this.baseURL}/admin/realms/${realmName}`;

    const { ok, status, statusText } = await fetch<unknown>(url, {
      method: "GET",
      headers: this.headers,
    });

    if (ok) {
      return true;
    }

    if (status !== fetchStatus.NOT_FOUND) {
      throw new Error(`Error checking for realm existence: ${statusText}`);
    }

    return false;
  }

  async createOrGetKeycloakRealm(realmName: string) {
    await this.connect();
    const doesRealmExist = await this.getRealm(realmName);
    if (doesRealmExist) {
      return;
    }

    const url = `${this.baseURL}/admin/realms`;
    const body = {
      realm: realmName,
      enabled: true,
    };

    const { ok, status, statusText } = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!ok) {
      throw new Error(`${status} ${statusText} from ${url}`);
    }
  }

  async getClientSecret(realmName: string, clientId: string): Promise<string> {
    const url = `${this.baseURL}/admin/realms/${realmName}/clients?clientId=${clientId}`;

    const { data, ok, status, statusText } = await fetch<clientIdInterface[]>(
      url,
      {
        method: "GET",
        headers: this.headers,
      }
    );

    if (!ok) {
      throw new Error(
        `Error getting clients for clientId ${clientId}: ${status} ${statusText}`
      );
    }

    if (data.length > 1) {
      throw new Error(`more than one client with the id ${clientId}`);
    }

    if (data.length == 1) {
      Log.info(`Client ID '${clientId}' already exists.`);
      if (data[0].secret) {
        return data[0].secret;
      } else {
        throw new Error(
          `Existing client '${clientId}' is not a confidential client, no secret is available.`
        );
      }
    }
  }

  async createOrGetClientSecret(
    realmName: string,
    clientId: string,
    clientName: string
  ) {
    await this.connect();

    // if the client secret already exists, return it.
    let secret = await this.getClientSecret(realmName, clientId);
    if (secret !== undefined) {
      return secret;
    }

    const url = `${this.baseURL}/admin/realms/${realmName}/clients`;
    const body = {
      clientId,
      name: clientName,
      enabled: true,
      protocol: "openid-connect",
      publicClient: false, // Make this a confidential client
      clientAuthenticatorType: "client-secret", // Use client secret for authentication
    };

    const { ok, status, statusText } = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!ok) {
      throw new Error(`${status} ${statusText} from ${url}`);
    }

    secret = await this.getClientSecret(realmName, clientId);
    if (secret === undefined) {
      throw new Error(
        `Could not find secret for the ${clientName} and id ${clientId}`
      );
    }

    Log.info(
      `Successfully created client '${clientName}' with client ID '${clientId}'`
    );

    return secret;
  }
}
