# 1. Admission-time verification of image signatures

Date: 2024-10-10

## Status

In progress


## Context

This doc is for working through the details necessary to come to 


## Decision

TBD


## Consequences

TBD

Immediate questions:
- How do we get image sigs from remote/zarf registries?
  - OCI introspection tools? Oras?
  - go libs (crane?)
  - Something else in TS?
  - offline sigs: cosign save & cosign verify?
    - https://github.com/sigstore/cosign/tree/main?tab=readme-ov-file#verify-a-container-in-an-air-gapped-environment
- Can we use `cosign` from TypeScript/JavaScript?  (Jeff says in #product-support thread)
  - Are there alternatives to cosign for validation?  OpenSSL stuff?
- Cosign binary is 105MB (which is almost the same size as the Pepr controller itself).  Is that advisable?
  - easiest impl; include & done!  But what about growth potential?
- Is there a way to pull in the a go library an just use _that_ from cosign?
  - https://github.com/gopherjs/gopherjs ..?  Pros, cons?
  - wasm (entrypoint-wasm.test.ts, etc.)? Pros, cons?
    - https://go.dev/wiki/WebAssembly
    - https://github.com/cmwylie19/wasm-pepr-test/blob/main/pepr-test-module/capabilities/hello-pepr.ts
    - opaque binary (so debugging gets tricky..?)
    - doesn't need to talk over network to sidecar
    - network call from Go, piped back into JS: https://github.com/SamDz16/goWasm-http-request/blob/master/main.go#L40
  - sidecar w/ coms over GRPc
    - https://github.com/cmwylie19/watch-informer/blob/main/pkg/server/server.go
    - https://github.com/defenseunicorns/pepr/pull/1087/files 