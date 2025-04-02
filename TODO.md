```bash
operator-sdk init --domain example.com --repo github.com/example/memcached-operator

operator-sdk create api --group cache --version v1alpha1 --kind Memcached --resource --controller
```

TODO:
- [ ] cli command api generate-types- generates API types in api/<version>

- [ ] cli command api generate-crd reads the api/<version> types and generates the CRD in config/crd/bases

Uknowns:
-  [ ] point to path to generate 


operator-sdk generate crds reads the API Types from onfig/crd/bases
