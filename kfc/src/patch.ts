import { V1NetworkPolicyPeer } from "@kubernetes/client-node";

declare module "@kubernetes/client-node" {
  interface V1NetworkPolicyIngressRule {
    from?: Array<V1NetworkPolicyPeer>;
    // No need to redeclare other unchanged properties
  }
}
