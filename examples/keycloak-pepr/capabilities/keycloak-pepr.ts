import { Capability, a } from "pepr";
import { getKeycloakAccessToken, createOrGetKeycloakRealm, createOrGetClient, createUser} from './keycloak-api';
import { getSecretValue, createKubernetesSecret } from './kubernetes-api';


export const KeyCloakPepr = new Capability({
  name: "keycloakpepr",
  description: "Simple example to configure keycloak realm and clientid",
  namespaces: [],
});

// LOLZ you cannot connect from the debuggging to a clusterip service :) 
//const keycloakBaseUrl = "http://keycloak.default.svc.cluster.local"
const keycloakBaseUrl = "http://localhost:9999"

const secretName = "keycloak"
const namespaceName = "default"


const { When } = KeyCloakPepr;

When(a.ConfigMap)
  .IsCreatedOrUpdated()
  .WithName("config")
  .Then(async request => {
    const token = await getKeycloakAccessToken(keycloakBaseUrl, "admin-cli", "user",namespaceName,secretName)
    console.log(`keycloak token is ${token}`)

    const realm = await createOrGetKeycloakRealm(keycloakBaseUrl,token,"yoda")
    console.log(`keycloak realm is ${realm}`)

    const clientId = "dagoba"
    const clientName = "swamp"
    const secret = await createOrGetClient(keycloakBaseUrl,token,realm,clientId,clientName)
    console.log(`keycloak client secret is ${secret}`)

  });


When(a.Secret).IsCreated().WithName("user")
.Then(async request => {

  const userName = getVal(request.Raw.data, 'user')
  if (userName == undefined) {
    return
  }

  const token = await getKeycloakAccessToken(keycloakBaseUrl, "admin-cli", "user",namespaceName,secretName)
  console.log(`keycloak token is ${token}`)

  const password = await createUser(keycloakBaseUrl, token, "yoda", userName, `barry+${userName}@defenseunicorns.com`, "baby", "yoda")
  if (password != undefined) {
    await createKubernetesSecret("default", userName, userName, password)
  }
});

function getVal(data: {[key: string]: string}, p: string): string {
  if (data && data[p]) {
    return Buffer.from(data[p], "base64").toString("utf-8");
  }
  return undefined
}
