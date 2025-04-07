// Auto-generated CRD TypeScript definition
// Kind: Memcache
// Group: cache
// Version: v1alpha1
// Domain: pepr.dev

export interface MemcacheSpec {
  // INSERT ADDITIONAL SPEC FIELDS - desired state of cluster
  // Important: Run "npx pepr crd generate" to regenerate code after modifying this file

  // Size defines the number of Memcache instances
  Size?: number[];

  // Port defines the port that will be used to init the container with the image
  ContainerPort: number;

  // Application specific configuration
  Config?: {
    language: string[];
    timezone: number;
    zone: {
      state: string
      areaCode: string[]
    }
  };
}

export interface MemcacheStatus {
  conditions: MemcacheStatusCondition[];
}

export const details = {
  plural: "memcaches",
  scope: "Namespaced",
  shortName: "mc",
};

type MemcacheStatusCondition = {
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
   * Work location.
   */
  work: {
    name: string;
    namespace: string;
    status: string;
    message: string;
  }
};


