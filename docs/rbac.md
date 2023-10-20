# RBAC Modes

During the build phase of Pepr (`npx pepr build --rbac-mode [admin|scoped]`), you have the option to specify the desired RBAC mode through specific flags. This allows fine-tuning the level of access granted based on requirements and preferences.

## Modes

**admin**   

```bash
npx pepr build --rbac-mode admin
```

**Description:** The service account is given cluster-admin permissions, granting it full, unrestricted access across the entire cluster. This can be useful for administrative tasks where broad permissions are necessary. However, use this mode with caution, as it can pose security risks if misused. This is the default mode.

**scoped**

```bash
npx pepr build --rbac-mode scoped
```

**Description:** The service account is provided just enough permissions to perform its required tasks, and no more. This mode is recommended for most use cases as it limits potential attack vectors and aligns with best practices in security. _The admission controller's primary mutating or validating action doesn't require a ClusterRole (as the request is not persisted or executed while passing through admission control), if you have a use case where the admission controller's logic involves reading other Kubernetes resources or taking additional actions beyond just validating, mutating, or watching the incoming request, appropriate RBAC settings should be reflected in the ClusterRole._

## Debugging RBAC Issues

If encountering unexpected behaviors in Pepr while running in scoped mode, check to see if they are related to RBAC.

1. Check Deployment logs for RBAC errors:

```bash
kubectl logs -n pepr-system  -l app | jq 'select(.data.reason == "Forbidden")' | grep -A9 -B9 "Forbidden"

# example output
dden")' | grep -A9 -B9 "Forbidden"
  "time": 1697814589833,
  "pid": 16,
  "hostname": "pepr-e868e97f-0512-5a48-92c3-96a2e3b6da10-watcher-6f44f996pmhhb",
  "data": {
    "kind": "Status",
    "apiVersion": "v1",
    "metadata": {},
    "status": "Failure",
    "message": "peprstores.pepr.dev \"pepr-e868e97f-0512-5a48-92c3-96a2e3b6da10-store\" is forbidden: User \"system:serviceaccount:pepr-system:pepr-e868e97f-0512-5a48-92c3-96a2e3b6da10\" cannot get resource \"peprstores\" in API group \"pepr.dev\" in the namespace \"pepr-system\": RBAC: clusterrole.rbac.authorization.k8s.io \"pepr-e868e97f-0512-5a48-92c3-96a2e3b6da10\" not found",
    "reason": "Forbidden",
    "details": {
      "name": "pepr-e868e97f-0512-5a48-92c3-96a2e3b6da10-store",
      "group": "pepr.dev",
      "kind": "peprstores"
    },
    "code": 403
  },
  "ok": false,
  "status": 403,
  "statusText": "Forbidden"
}
{
  "level": 50,
  "time": 1697814589840,
  "pid": 16,
  "hostname": "pepr-e868e97f-0512-5a48-92c3-96a2e3b6da10-watcher-6f44f996pmhhb",
  "data": {
    "kind": "Status",
    "apiVersion": "v1",
    "metadata": {},
    "status": "Failure",
    "message": "peprstores.pepr.dev \"pepr-e868e97f-0512-5a48-92c3-96a2e3b6da10-store\" is forbidden: User \"system:serviceaccount:pepr-system:pepr-e868e97f-0512-5a48-92c3-96a2e3b6da10\" cannot patch resource \"peprstores\" in API group \"pepr.dev\" in the namespace \"pepr-system\": RBAC: clusterrole.rbac.authorization.k8s.io \"pepr-e868e97f-0512-5a48-92c3-96a2e3b6da10\" not found",
    "reason": "Forbidden",
    "details": {
      "name": "pepr-e868e97f-0512-5a48-92c3-96a2e3b6da10-store",
      "group": "pepr.dev",
      "kind": "peprstores"
    },
    "code": 403
  },
  "ok": false,
  "status": 403,
  "statusText": "Forbidden",
  "msg": "Failed to create Pepr store"
}
```

2. Verify ServiceAccount Permissions with `kubectl auth can-i`

```bash
SA=$(kubectl get deploy -n pepr-system -o=jsonpath='{range .items[0]}{.spec.template.spec.serviceAccountName}{"\n"}{end}')

# Can i create configmaps as the service account?
kubectl auth can-i create cm --as=system:serviceaccount:pepr-system:$SA

# example output: yes

# Can i create configmaps as the service account in kube-system?
kubectl auth can-i create cm --as=system:serviceaccount:pepr-system:$SA -n kube-system

# example output: no
```

3. Describe the ServiceAccount

```bash
SA=$(kubectl get deploy -n pepr-system -o=jsonpath='{range .items[0]}{.spec.template.spec.serviceAccountName}{"\n"}{end}')

kubectl describe clusterrole $SA

# example output:
Name:         pepr-e868e97f-0512-5a48-92c3-96a2e3b6da10
Labels:       <none>
Annotations:  <none>
PolicyRule:
  Resources  Non-Resource URLs  Resource Names  Verbs
  ---------  -----------------  --------------  -----
  *.*        []                 []              [create delete get list patch update watch]
```
