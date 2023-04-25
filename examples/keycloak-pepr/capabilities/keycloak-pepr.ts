import { Capability, a } from "pepr"; import { keycloakAPI } from './keycloak-api';
import { createKubernetesSecret, getSecretValue, createKubernetesClientSecret } from './kubernetes-api';

export const KeyCloakPepr = new Capability({
  name: "keycloakpepr",
  description: "Simple example to configure keycloak realm and clientid",
  namespaces: [],
});

// LOLZ you cannot connect from the debuggging to a clusterip service :) 
//const keycloakBaseUrl = "http://keycloak.default.svc.cluster.local"
const keycloakBaseUrl = "http://localhost:9999"

// stuff that should come from the configmap
const secretName = "keycloak"
const keycloakNameSpace = "default"


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

    const realmName = getVal(request.Raw.data, 'realmName')
    const clientId = getVal(request.Raw.data, 'clientId')
    const clientName = getVal(request.Raw.data, 'clientName')

    const namespaceName = request.Raw.metadata.namespace

    const password = await getSecretValue(keycloakNameSpace, secretName, "admin-password")

    // XXX: BDW: init the kc API, pass in username/password, get a token
    const kcAPI = new keycloakAPI(keycloakBaseUrl, password, clientId)

    // XXX: BDW: realmname should come from config
    await kcAPI.createOrGetKeycloakRealm(realmName)

    const secret = await kcAPI.createOrGetClientSecret(realmName, clientId, clientName)

    await createKubernetesClientSecret(namespaceName, "clientsecret", realmName, clientId, clientName, secret)
    console.log(`keycloak client secret has been stored`)

  });

// XXX: BDW: handle the keycloak clientid/secret and do the authservice stuff...
// When.....



When(a.Secret).IsCreated().WithName("user")
  .Then(async request => {

    const userName = getVal(request.Raw.data, 'user')
    const email = getVal(request.Raw.data, 'email')
    const firstname = getVal(request.Raw.data, 'firstname')
    const lastname = getVal(request.Raw.data, 'lastname')

    const namespaceName = request.Raw.metadata.namespace

    const realmName = "yoda"
    const clientId = "dagoba"
    const clientName = "swamp"

    const password = await getSecretValue(keycloakNameSpace, secretName, "admin-password")
    const kcAPI = new keycloakAPI(keycloakBaseUrl, password, clientId)
    const generatedPassword = await kcAPI.createUser(realmName, userName, email, firstname, lastname)
    await createKubernetesSecret(namespaceName, userName, userName, generatedPassword)

  });

function getVal(data: { [key: string]: string }, p: string): string {
  if (data && data[p]) {
    return Buffer.from(data[p], "base64").toString("utf-8");
  }
  throw new Error("${p} not in the secret")
}

