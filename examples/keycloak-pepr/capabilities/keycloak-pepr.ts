import { Capability, a } from "pepr";
import { KeycloakAPI } from "./keycloak-api";
import { K8sAPI } from "./kubernetes-api";

export const KeyCloakPepr = new Capability({
  name: "keycloak-pepr",
  description: "Simple example to configure keycloak realm and clientid",
  namespaces: [],
});

// LOLZ you cannot connect from the debuggging to a clusterip service :)
// const keycloakBaseUrl = "http://keycloak.default.svc.cluster.local"
const keycloakBaseUrl = "http://localhost:9999";

// stuff that should come from the configmap
const secretName = "keycloak";
const keycloakNameSpace = "keycloak";

// XXX: TODO: should we be able to revoke the root keycloak creds.
// XXX: TODO: key rotation example.
// XXX: TODO: Rollback if failure.

const { When } = KeyCloakPepr;

// XXX: BDW: fix up the When()
When(a.Secret)
  .IsCreatedOrUpdated()
  .WithName("config")
  .WithLabel("create", "clientidsecret")
  .Then(async request => {
    // XXX: TODO grab dry-run things
    // XXX: BDW: TODO: keep track of requests per second, don't break the keycloak api...

    const k8sApi = new K8sAPI();
    const realmName = getVal(request.Raw.data, "realmName");
    const clientId = getVal(request.Raw.data, "clientId");
    const clientName = getVal(request.Raw.data, "clientName");

    const namespaceName = request.Raw.metadata.namespace;

    const password = await k8sApi.getSecretValue(
      keycloakNameSpace,
      secretName,
      "admin-password"
    );

    // XXX: BDW: init the kc API, pass in username/password, get a token
    const kcAPI = new KeycloakAPI(keycloakBaseUrl, password, clientId);

    // XXX: BDW: realmname should come from config
    await kcAPI.createOrGetKeycloakRealm(realmName);

    const secret = await kcAPI.createOrGetClientSecret(
      realmName,
      clientId,
      clientName
    );
    request.Raw.data['clientSecret'] = Buffer.from(secret).toString("base64")
    request.RemoveLabel("create")
    request.SetLabel("secret", "created")


    console.log(`keycloak client secret has been stored`);
  });

// XXX: BDW: handle the keycloak clientid/secret and do the authservice stuff...
// When.....

When(a.Secret)
  .IsCreated()
  .WithName("user")
  .Then(async request => {
    const userName = getVal(request.Raw.data, "user");
    const email = getVal(request.Raw.data, "email");
    const firstName = getVal(request.Raw.data, "firstname");
    const lastName = getVal(request.Raw.data, "lastname");

    const namespaceName = request.Raw.metadata.namespace;

    const realmName = "yoda";
    const clientId = "dagoba";
    const k8sApi = new K8sAPI();

    const password = await k8sApi.getSecretValue(
      keycloakNameSpace,
      secretName,
      "admin-password"
    );

    const kcAPI = new KeycloakAPI(keycloakBaseUrl, password, clientId);

    const generatedPassword = await kcAPI.createUser(
      realmName,
      userName,
      email,
      firstName,
      lastName
    );

    await k8sApi.createKubernetesSecret(
      namespaceName,
      userName,
      userName,
      generatedPassword
    );
  });

function getVal(data: { [key: string]: string }, p: string): string {
  if (data && data[p]) {
    return Buffer.from(data[p], "base64").toString("utf-8");
  }
  throw new Error(`${p} not in the secret`);
}
