// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { afterAll, beforeAll, expect } from "@jest/globals";
import { describe, it } from "@jest/globals";
import * as sut from "./cosign";

// Refs:
// airgap cosign sign: https://github.com/sigstore/cosign/issues/3437
// - don't upload to Rekor w/ "cosign sign --tlog-upload=false" flag

// airgap cosign verify: https://github.com/sigstore/cosign/issues/3423
// - don't require verification in Rekor w/ "cosign verify --insecure-ignore-tlog=false --offline=true" flag

describe("verifyImage()", () => {
  let iref: string;
  let cscs: string[];

  beforeAll(() => {
    // create a Dockerfile
    // > echo "FROM docker.io/library/hello-world"
    //
    // > docker build --tag ttl.sh/c8565cc7-55c7-433f-b1ad-cc7cf54ee75b:30m --push .
    // --or--
    // >docker build --tag ttl.sh/c8565cc7-55c7-433f-b1ad-cc7cf54ee75b:30m
    // > docker push ttl.sh/c8565cc7-55c7-433f-b1ad-cc7cf54ee75b:30m
    // create a new cosign keypair
    // > COSIGN_PASSWORD="password" cosign generate-key-pair
    // > mv cosign.pub cosign-A.pub
    // > mv cosign.key cosign-A.key
    // > COSIGN_PASSWORD="password" cosign generate-key-pair
    // > mv cosign.pub cosign-B.pub
    // > mv cosign.key cosign-B.key
    // sign image
    // > COSIGN_PASSWORD="password" cosign sign --key cosign-A.key ttl.sh/c8565cc7-55c7-433f-b1ad-cc7cf54ee75b:30m
    // verify image
    // > cosign verify --insecure-ignore-tlog=true --key cosign-A.pub ttl.sh/c8565cc7-55c7-433f-b1ad-cc7cf54ee75b:30m
    // > cosign verify --insecure-ignore-tlog=true --key cosign-B.pub ttl.sh/c8565cc7-55c7-433f-b1ad-cc7cf54ee75b:30m
  });

  afterAll(() => {
    // clean up keypair / signing certificates / temporary files
    // delete image from ttl.sh..?
  });

  it("accepts pubkeys", () => {
    iref = "???";
    cscs = ["???", "???", "??"];

    expect(sut.verifyImage(iref, cscs)).toBe(false);
  });
});

// it("accepts certs & cert chains..?", () => {});
//  https://docs.sigstore.dev/cosign/signing/signing_with_containers/#sign-and-attach-a-certificate-and-certificate-chain

// Immediate questions:
// - How do we get image sigs from remote/zarf registries?
//   - OCI introspection tools? Oras?
//   - go libs (crane?)
//   - Something else in TS?
//   - offline sigs: cosign save & cosign verify?
//     - https://github.com/sigstore/cosign/tree/main?tab=readme-ov-file#verify-a-container-in-an-air-gapped-environment
// - Can we use `cosign` from TypeScript/JavaScript?  (Jeff says in #product-support thread)
//   - Are there alternatives to cosign for validation?  OpenSSL stuff?
// - Cosign binary is 105MB (which is almost the same size as the Pepr controller itself).  Is that advisable?
//   - easiest impl; include & done!  But what about growth potential?
// - Is there a way to pull in the a go library an just use _that_ from cosign?
//   - https://github.com/gopherjs/gopherjs ..?  Pros, cons?
//   - wasm (entrypoint-wasm.test.ts, etc.)? Pros, cons?
//     - https://go.dev/wiki/WebAssembly
//     - https://github.com/cmwylie19/wasm-pepr-test/blob/main/pepr-test-module/capabilities/hello-pepr.ts
//     - opaque binary (so debugging gets tricky..?)
//     - doesn't need to talk over network to sidecar
//     - network call from Go, piped back into JS: https://github.com/SamDz16/goWasm-http-request/blob/master/main.go#L40
//   - sidecar w/ coms over GRPc
//     - https://github.com/cmwylie19/watch-informer/blob/main/pkg/server/server.go
//     - https://github.com/defenseunicorns/pepr/pull/1087/files
