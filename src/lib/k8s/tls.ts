import forge from "node-forge";

const CA_NAME = "Pepr Ephemeral CA";

export interface TLSOut {
  ca: string;
  crt: string;
  key: string;
  pem: {
    ca: string;
    crt: string;
    key: string;
  };
}

/**
 * Generates a self-signed CA and server certificate with Subject Alternative Names (SANs) for the K8s webhook.
 *
 * @param {string} name - The name to use for the server certificate's Common Name and SAN DNS entry.
 * @returns {TLSOut} - An object containing the Base64-encoded CA, server certificate, and server private key.
 */
export function genTLS(name: string): TLSOut {
  // Generate a new CA key pair and create a self-signed CA certificate
  const caKeys = forge.pki.rsa.generateKeyPair(2048);
  const caCert = genCert(caKeys, CA_NAME, [{ name: "commonName", value: CA_NAME }]);

  // Set extensions for the CA certificate
  setExtensions(caCert, [
    { name: "basicConstraints", cA: true },
    { name: "keyUsage", keyCertSign: true, digitalSignature: true, nonRepudiation: true, keyEncipherment: true, dataEncipherment: true },
  ]);

  // Generate a new server key pair and create a server certificate signed by the CA
  const serverKeys = forge.pki.rsa.generateKeyPair(2048);
  const serverCert = genCert(serverKeys, name, caCert.subject.attributes);

  // Sign both certificates with the CA private key
  caCert.sign(caKeys.privateKey, forge.md.sha256.create());
  serverCert.sign(caKeys.privateKey, forge.md.sha256.create());

  // Convert the keys and certificates to PEM format
  const pem = {
    ca: forge.pki.certificateToPem(caCert),
    crt: forge.pki.certificateToPem(serverCert),
    key: forge.pki.privateKeyToPem(serverKeys.privateKey),
  };

  // Base64-encode the PEM strings
  const ca = Buffer.from(pem.ca).toString("base64");
  const key = Buffer.from(pem.key).toString("base64");
  const crt = Buffer.from(pem.crt).toString("base64");

  return { ca, key, crt, pem };
}

/**
 * Generates a new certificate with the given key pair, name, and issuer.
 *
 * @param {forge.pki.rsa.KeyPair} key - The key pair to use for the certificate.
 * @param {string} name - The name to use for the certificate's Common Name and SAN DNS entry.
 * @param {forge.pki.CertificateField[]} issuer - The issuer of the certificate.
 * @returns {forge.pki.Certificate} - The generated certificate.
 */
function genCert(key: forge.pki.rsa.KeyPair, name: string, issuer: forge.pki.CertificateField[]): forge.pki.Certificate {
  const cert = forge.pki.createCertificate();
  cert.publicKey = key.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  // Add SANs to the certificate
  setExtensions(cert, [{ name: "subjectAltName", altNames: [{ type: 2, value: name }] }]);

  // Set the certificate's issuer
  cert.setIssuer(issuer);

  return cert;
}

/**
 * Sets extensions for the given certificate.
 *
 * @param {forge.pki.Certificate} cert - The certificate to set extensions for.
 * @param {forge.pki.Extension[]} extensions - The extensions to set.
 */
function setExtensions(cert: forge.pki.Certificate, extensions: forge.pki.Extension[]): void {
  cert.setExtensions(extensions);
}