import { ImagePullSecret } from "../../lib/types";
import { sanitizeName } from "../init/utils";

export interface ImagePullSecretDetails {
  pullSecret?: string;
  dockerServer?: string;
  dockerUsername?: string;
  dockerEmail?: string;
  dockerPassword?: string;
}

export function validateImagePullSecretDetails(details: ImagePullSecretDetails): {
  valid: boolean;
  error?: string;
} {
  if (!details.pullSecret) {
    return { valid: true };
  }

  // https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#dns-subdomain-names
  if (details.pullSecret !== sanitizeName(details.pullSecret)) {
    return {
      valid: false,
      error: `Invalid --pullSecret. Must be valid name as defined in RFC 1123.`,
    };
  }

  const missing: string[] = [];
  if (!details.dockerEmail) {
    missing.push("--docker-email");
  }
  if (!details.dockerServer) {
    missing.push("--docker-server");
  }
  if (!details.dockerUsername) {
    missing.push("--docker-username");
  }
  if (!details.dockerPassword) {
    missing.push("--docker-password");
  }

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Error: Must provide ${missing.join(", ")} when providing --pull-secret`,
    };
  }

  return { valid: true };
}

type ValidatedImagePullSecretDetails = Required<ImagePullSecretDetails>;

export function generateImagePullSecret(details: ValidatedImagePullSecretDetails): ImagePullSecret {
  const auth = Buffer.from(`${details.dockerUsername}:${details.dockerPassword}`).toString(
    "base64",
  );
  return {
    auths: {
      [details.dockerServer]: {
        username: details.dockerUsername,
        password: details.dockerPassword,
        email: details.dockerEmail,
        auth,
      },
    },
  };
}
