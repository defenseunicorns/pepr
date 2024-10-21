// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// import { sign, verify } from "sigstore";

/**
 * Returns all containers in a pod
 * @param {string} iref image reference
 * @param {array} pubkeys list of viable code signing pubkeys
 * @returns {boolean} whether the iref was signed by a key in the pubkeys
 */
export function verifyImage(iref: string, pubkeys: string[]) {
  console.log("image ref:", iref, "code signing keys:", JSON.stringify(pubkeys));
  return true;

  // can find out where an image signature lives with "cosign triangulate"
  //  https://docs.sigstore.dev/cosign/signing/signing_with_containers/#signature-location-and-management

  // I understand that a "signature" is stored in the OCI registry (at `cosign triangulate $IMG`), but...
  //  without fulcio/rekor:
  //  - What is a "cosign verify" actually doing?
  //  - Should this func be taking signing certs?  Or pubkeys?  Can one be derived from the other?

  // https://edu.chainguard.dev/open-source/sigstore/cosign/an-introduction-to-cosign/#cosign-with-keys
}
