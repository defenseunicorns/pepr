// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// @todo: quick and dirty temp tls chain for testing, to be replaced at runtime
// Don't freak out, this is a self-signed cert for testing purposes only.
import forge from "node-forge";

export interface TLSOut {
  ca: string;
  crt: string;
  key: string;
}

export function genTLS(name: string): TLSOut {
  // Generate a new CA key pair
  const caKeys = forge.pki.rsa.generateKeyPair(2048);
  const caCert = forge.pki.createCertificate();
  caCert.publicKey = caKeys.publicKey;
  caCert.serialNumber = "01";
  caCert.validity.notBefore = new Date();
  caCert.validity.notAfter = new Date();
  caCert.validity.notAfter.setFullYear(caCert.validity.notBefore.getFullYear() + 1);
  const caAttrs = [
    {
      name: "commonName",
      value: "Pepr Ephemeral CA",
    },
  ];
  caCert.setSubject(caAttrs);
  caCert.setIssuer(caAttrs);
  caCert.sign(caKeys.privateKey, forge.md.sha256.create());

  // Generate a new key pair
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [
    {
      name: "commonName",
      value: `${name}.pepr-system.svc`,
    },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(caCert.subject.attributes);
  cert.sign(caKeys.privateKey, forge.md.sha256.create());

  // Convert the keys and certificates to PEM format
  const ca = Buffer.from(forge.pki.certificateToPem(caCert)).toString("base64");
  const key = Buffer.from(forge.pki.privateKeyToPem(keys.privateKey)).toString("base64");
  const crt = Buffer.from(forge.pki.certificateToPem(cert)).toString("base64");

  return { ca, key, crt };
}
