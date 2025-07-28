// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

export const createCRDscaffold = (
  group: string,
  version: string,
  kind: string,
  data: {
    domain: string;
    plural: string;
    scope: string;
    shortName: string;
  },
): string => {
  return `// Auto-generated CRD TypeScript definition
// Kind: ${kind}
// Group: ${group}
// Version: ${version}
// Domain: ${data.domain}

export interface ${kind}Spec {
  // INSERT ADDITIONAL SPEC FIELDS - desired state of cluster
  // Important: Run "npx pepr crd generate" to regenerate code after modifying this file

  /** 
   * Size defines the number of Memcache instances 
   */
  Size?: number[];

  /** 
   * Port defines the port that will be used to init the container with the image 
   */
  ContainerPort: number;

  /** 
   * Application specific configuration 
   */
  Config?: {
    language: string[];
    timezone: number;
    zone: {
      state: string;
      areaCode: string[];
    };
  };
}

export interface ${kind}Status {
  conditions: ${kind}StatusCondition[];
}

export const details = {
  plural: "${data.plural}",
  scope: "${data.scope}",
  shortName: "${data.shortName}",
};

type ${kind}StatusCondition = {
  /**
   * lastTransitionTime is the last time the condition transitioned from one status to another. This is not guaranteed to be set in happensBefore order across different conditions for a given object. It may be unset in some circumstances.
   */
  lastTransitionTime: Date;
  /**
   * message is a human readable message indicating details about the transition. This may be an empty string.
   */
  message: string;
  /**
   * observedGeneration represents the .metadata.generation that the condition was set based upon. For instance, if .metadata.generation is currently 12, but the .status.conditions[x].observedGeneration is 9, the condition is out of date with respect to the current state of the instance.
   */
  observedGeneration?: number;
  /**
   * reason contains a programmatic identifier indicating the reason for the condition's last transition. Producers of specific condition types may define expected values and meanings for this field, and whether the values are considered a guaranteed API. The value should be a CamelCase string. This field may not be empty.
   */
  reason: string;
  /**
   * status of the condition, one of True, False, Unknown.
   */
  status: string;
  /**
   * VM location.
   */
  vm: {
    name: string;
    region: string;
    status: string;
    message: string;
  }
};


`;
};
