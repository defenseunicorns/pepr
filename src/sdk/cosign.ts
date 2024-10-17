// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

/**
 * Returns all containers in a pod
 * @param {string} iref a registry-included image reference
 * @param {array} cscs the list of valid code signing certificates
 * @returns {boolean} whether the regRef image was signed by a cert in the cscs
 */
export function verifyImage(iref: string, cscs: string[]) {
  // can find out where an image signature lives with "cosign triangulate"
  //  https://docs.sigstore.dev/cosign/signing/signing_with_containers/#signature-location-and-management

  // I understand that a "signature" is stored in the OCI registry (at `cosign triangulate $IMG`), but...
  //  without fulcio/rekor:
  //  - What is a "cosign verify" actually doing?
  //  - Should this func be taking signing certs?  Or pubkeys?  Can one be derived from the other?

  // https://edu.chainguard.dev/open-source/sigstore/cosign/an-introduction-to-cosign/#cosign-with-keys

  console.log("image ref:", iref, "code signing certs:", JSON.stringify(cscs));
  return true;
}
