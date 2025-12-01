# RBAC Modes

During the build phase of Pepr (`npx pepr build --rbac-mode [admin|scoped]`), you have the option to specify the desired RBAC mode through specific flags. This allows fine-tuning the level of access granted based on requirements and preferences.

## Modes

### admin

```bash
npx pepr build --rbac-mode admin
```

**Description:** The service account is given cluster-admin permissions, granting it full, unrestricted access across the entire cluster. This can be useful for administrative tasks where broad permissions are necessary. However, use this mode with caution, as it can pose security risks if misused. This is the default mode.

### scoped

```bash
npx pepr build --rbac-mode scoped
```

**Description:** The service account is provided just enough permissions to perform its required tasks, and no more. This mode is recommended for most use cases as it limits potential attack vectors and aligns with best practices in security. _The admission controller's primary mutating or validating action doesn't require a ClusterRole (as the request is not persisted or executed while passing through admission control), if you have a use case where the admission controller's logic involves reading other Kubernetes resources or taking additional actions beyond just validating, mutating, or watching the incoming request, appropriate RBAC settings should be reflected in the ClusterRole. See how in [Updating the ClusterRole](#updating-the-clusterrole)._

## Debugging RBAC Issues

If encountering unexpected behaviors in Pepr while running in scoped mode, check to see if they are related to RBAC.

### Step 1: Check Deployment logs for RBAC errors

```bash
kubectl logs -n pepr-system  -l app | jq

# example output
{
  "level": 50,
  "time": 1697983053758,
  "pid": 16,
  "hostname": "pepr-static-test-watcher-745d65857d-pndg7",
  "data": {
    "kind": "Status",
    "apiVersion": "v1",
    "metadata": {},
    "status": "Failure",
    "message": "configmaps \"pepr-ssa-demo\" is forbidden: User \"system:serviceaccount:pepr-system:pepr-static-test\" cannot patch resource \"configmaps\" in API group \"\" in the namespace \"pepr-demo-2\"",
    "reason": "Forbidden",
    "details": {
      "name": "pepr-ssa-demo",
      "kind": "configmaps"
    },
    "code": 403
  },
  "ok": false,
  "status": 403,
  "statusText": "Forbidden",
  "msg": "Does the ServiceAccount have permissions to CREATE and PATCH this ConfigMap?"
}
```

### Step 2: Verify ServiceAccount Permissions with `kubectl auth can-i`

```bash
SA=$(kubectl get deploy -n pepr-system -o=jsonpath='{range .items[0]}{.spec.template.spec.serviceAccountName}{"\n"}{end}')

# Can i create configmaps as the service account in pepr-demo-2?
kubectl auth can-i create cm --as=system:serviceaccount:pepr-system:$SA -n pepr-demo-2

# example output: no
```

### Step 3: Describe the ClusterRole

```bash
SA=$(kubectl get deploy -n pepr-system -o=jsonpath='{range .items[0]}{.spec.template.spec.serviceAccountName}{"\n"}{end}')

kubectl describe clusterrole $SA

# example output:
Name:         pepr-static-test
Labels:       <none>
Annotations:  <none>
PolicyRule:
  Resources            Non-Resource URLs  Resource Names  Verbs
  ---------            -----------------  --------------  -----
  peprstores.pepr.dev  []                 []              [create delete get list patch update watch]
  configmaps           []                 []              [watch]
  namespaces           []                 []              [watch]
```

## Updating the ClusterRole

As discussed in the [Modes](#modes) section, the admission controller's primary mutating or validating action doesn't require a ClusterRole (as the request is not persisted or executed while passing through admission control), if you have a use case where the admission controller's logic involves reading other Kubernetes resources or taking additional actions beyond just validating, mutating, or watching the incoming request, appropriate RBAC settings should be reflected in the ClusterRole.

### Step 1: Figure out the desired permissions

**(`kubectl create clusterrole --help` is a good place to start figuring out the syntax)**

```bash
 kubectl create clusterrole configMapApplier --verb=create,patch --resource=configmap --dry-run=client -oyaml

 # example output
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  creationTimestamp: null
  name: configMapApplier
rules:
- apiGroups:
  - ""
  resources:
  - configmaps
  verbs:
  - create
  - patch
```

### Step 2: Update the ClusterRole in the `dist` folder

```yaml
...
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: pepr-static-test
rules:
  - apiGroups:
      - pepr.dev
    resources:
      - peprstores
    verbs:
      - create
      - get
      - patch
      - watch
  - apiGroups:
      - ''
    resources:
      - namespaces
    verbs:
      - watch
  - apiGroups:
      - ''
    resources:
      - configmaps
    verbs:
      - watch
      - create # New
      - patch  # New
...
```

### Step 3: Apply the updated configuration
