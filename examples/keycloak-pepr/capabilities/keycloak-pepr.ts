import { Capability, a } from "pepr";import {keycloakAPI } from './keycloak-api';
import { createKubernetesSecret, getSecretValue } from './kubernetes-api';

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

const realmName = "yoda"
const clientId = "dagoba"
const clientName = "swamp"


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
    if (realmName == undefined) {
      return
    }
    const clientId = getVal(request.Raw.data, 'clientId')
    if (clientId == undefined) {
      return
    }
    const clientName = getVal(request.Raw.data, 'clientName')
    if (clientName == undefined) {
      return
    }
    const namespaceName = request.Raw.metadata.namespace || "default"
    // XXX: BDW: TODO: read creds from kubernetes secret.
    // XXX:BDW this will be in the keycloak namespace, not where I am currently maybe.

    const password = await getSecretValue(keycloakNameSpace, secretName, "admin-password")

    // XXX: BDW: init the kc API, pass in username/password, get a token
    const kcAPI = new keycloakAPI(keycloakBaseUrl,password,clientId)

    // XXX: BDW: realmname should come from config
    await kcAPI.createOrGetKeycloakRealm(realmName)

    const secret = await kcAPI.createOrGetClientSecret(realmName, clientId, clientName)
    // XXX: BDW: create a secret for this secret
    console.log(`keycloak client secret is ${secret}`)

  });

// XXX: BDW: handle the keycloak clientid/secret and do the authservice stuff...
// When.....



When(a.Secret).IsCreated().WithName("user")
.Then(async request => {

  const userName = getVal(request.Raw.data, 'user')
  if (userName == undefined) {
    return
  }
  const namespaceName = request.Raw.metadata.namespace || "default"

  const password = await getSecretValue(keycloakNameSpace, secretName, "admin-password")

  const kcAPI = new keycloakAPI(keycloakBaseUrl,password,clientId)

  const generatedPassword = await kcAPI.createUser(realmName,userName,`barry+${userName}@defenseunicorns.com`, "baby", "yoda")


  await createKubernetesSecret("default", userName, userName, generatedPassword)

  });

function getVal(data: {[key: string]: string}, p: string): string {
  if (data && data[p]) {
    return Buffer.from(data[p], "base64").toString("utf-8");
  }
  return undefined
}

