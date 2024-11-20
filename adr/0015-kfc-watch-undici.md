# 14. Admission-time verification of image signatures

Date: 2024-11-20


## Status

Accepted


## Context

The UDS and delivery teams observed that the Pepr Watch/Reconcile process was silently [missing events](https://github.com/defenseunicorns/pepr/issues/745). To address this, on May 23, 2024, we introduced an [Informer Pattern](https://github.com/defenseunicorns/kubernetes-fluent-client/releases/tag/v2.6.0) to periodically poll the Kubernetes API for changes to the resources Pepr monitors. While this change improved event monitoring, it did not fully resolve the issue.

Due to the critical need for the UDS Operator to respond quickly and reliably to cluster events, we required a solution that would ensure no events were missed.

### Initial Ask ###

Our CTO tasked us with evaluating four technologies to improve the situation:

1. v8Go
2. Native Fetch in Node.js
3. HTTP2 in Node.js
4. Undici

### Evaluation Criteria ###

We assessed the technologies based on the following criteria:

1. Performance and Stability: Can the solution handle the UDS Operator’s load without missing events?
2. Resource Utilization: How much memory and CPU does the solution consume?
3. Ease of Use: How easy is the solution to implement and maintain?

### Decision ###

**Native Fetch**  

- **Issue:** Native Fetch was ruled out because it does not support attaching the necessary CA to the request, making it unsuitable for our requirements.

**v8Go**

- **Issue:** Using v8Go would require re-implementing large parts of the Node.js standard library manually. For example, console.log did not work natively and required creating a wrapper in Go to pass into the Node.js context. The significant implementation and maintenance effort made this option unviable.

**HTTP2**

- **Evaluation:** While HTTP2 could handle the load and capture events, it suffered from a persistent memory leak. Despite implementing exponential backoffs and cleaning up the client after each request, the memory usage persistently rose causing crashes. We suspect the root cause lies in the HTTP2 library’s underlying [C++ implementation](https://github.com/nghttp2/nghttp2/issues/1065).


**Undici**

- **Decision:** The team selected Undici because it was the most performant and stable among the four options. After over 100 hours of soak testing with a Pepr Undici release candidate:

- `UDSPackages` were consistently reconciled.

- Resource utilization remained steady.

- No events were missed.



### Consequences ###

Adopting Undici had the following consequences:  

1. Test Rewrites: Since Undici does not respect nock, we had to rewrite our tests using its native Mock Agent.
2. Manual Trust Establishment: Unlike node-fetch, Undici required us to implement the logic for establishing trust with the Kubernetes API server manually. This would have been necessary for HTTP2 or Native Fetch as well.

##### Pros

- Requires minimal new code to implement.

- Actively maintained and widely used.

- Offers a simple, well-documented API.


##### Cons

- Requires manual implementation of trust logic with the Kubernetes API server. 

- Does not support nock, necessitating test rewrites using the native Mock Agent.

- Encourages replacing all node-fetch calls with Undici for consistency, increasing scope.

