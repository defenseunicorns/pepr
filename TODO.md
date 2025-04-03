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
- [] Generate the CRD when `crd generate` is run

Phase 2:
- [ ] Shortname
- [ ] Namespaced
- [ ] Plural
- [ ] Description

operator-sdk generate crds reads the API Types from config/crd/bases

```bash
npx ts-node src/cli.ts crd create --group cache --version v1alpha1 --kind Memcache

npx ts-node src/cli.ts crd generate
```
