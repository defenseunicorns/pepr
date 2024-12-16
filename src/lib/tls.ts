import forge from "node-forge";

const caName = "Pepr Ephemeral CA";

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
  const caCert = genCert(caKeys, caName, [{ name: "commonName", value: caName }]);

  caCert.setExtensions([
    {
      name: "basicConstraints",
      cA: true,
    },
    {
      name: "keyUsage",
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true,
    },
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

function genCert(
  key: forge.pki.rsa.KeyPair,
  name: string,
  issuer: forge.pki.CertificateField[],
): forge.pki.Certificate {
  const crt = forge.pki.createCertificate();
  crt.publicKey = key.publicKey;
  crt.serialNumber = "01";
  crt.validity.notBefore = new Date();
  crt.validity.notAfter = new Date();
  crt.validity.notAfter.setFullYear(crt.validity.notBefore.getFullYear() + 1);

  // Add SANs to the server certificate
  crt.setExtensions([
    {
      name: "subjectAltName",
      altNames: [
        {
          type: 2, // DNS
          value: name,
        },
      ],
    },
  ]);

  // Set the server certificate's issuer to the CA
  crt.setIssuer(issuer);

  return crt;
}
