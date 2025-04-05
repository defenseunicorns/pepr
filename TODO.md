```bash
operator-sdk init --domain example.com --repo github.com/example/memcached-operator

// Scaffolds the Go structs in  the /api/<group>/
operator-sdk create api --group cache --version v1alpha1 --kind Memcached --resource --controller
```

Phase 0:
- [x] root crd command
- [x] create command off crd command
- [x] generate crds command

Phase 1:
- [x] Generate the class/type when `crd create` is run
- [x] Generate the CRD when `crd generate` is run

Phase 2:
- [x] Shortname
- [x] Namespaced
- [x] Plural
- [x] Description
- [x] Status

Phase 3:
- [ ] regex101 links
- [ ] Complexity
- [ ] Unit Test
- [ ] Integration Test
- [ ] Documentation

operator-sdk generate crds reads the API Types from config/crd/bases

```bash
npx ts-node src/cli.ts crd create --group cache --version v1alpha1 --kind Memcache --shortName mc --plural memcaches --scope Namespaced

k delete mc --all
npx ts-node src/cli.ts crd generate
kubectl apply -f crds
kubectl apply -f -<<EOF
apiVersion: cache.pepr.dev/v1alpha1
kind: Memcache
metadata:
  name: memcached-sample
  namespace: default
spec:
  size: [3,3]
  containerPort: 8080
  config: 
    data: okay
    asdf: [1,1,3,4]
EOF
```


        // Not optional, subresource must be present and it is empty
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
