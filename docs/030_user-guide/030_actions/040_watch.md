# Watch

[Kubernetes](https://kubernetes.io/docs/reference/using-api/api-concepts) supports efficient change notifications on resources via watches. Pepr uses the Watch action for monitoring resources that previously existed in the cluster and for performing long-running asynchronous events upon receiving change notifications on resources, as watches are not limited by [timeouts](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#timeouts).
