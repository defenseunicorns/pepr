# 7: Reconcile Action

Date: 2024-02-08

## Status

---

## Context

As our `Watch` processor was enhanced to become more reliable, Pepr became a stronger candidate for Kubernetes Operator and Controller development. We needed a built in mechanism to guarantee state consistency of Kubernetes resources. 


## Decision

Add a `Queue` to the Watch controller and expose it as a new action called `Reconcile`. In many scenarios involving Kubernetes Resource Controller or Operator patterns, utilizing a queue makes sense to sequentially handle events as they are returned by the Kubernetes API.  It also allows handling of bursts of activity without overwhelming the system or the Kubernetes API. In addition, it provides a mechanism to back off when the system is under heavy load, enhancing overall stability and maintaining the state consistency of Kubernetes resources, as there are many cases in which the order of operations can impact the final state of a resource.

```typescript
When(WebApp)
  .IsCreatedOrUpdated()
  .Validate(validator)
  .Reconcile(async instance => {
    // DO WORK HERE
```


## Consequences

1. Add another action to the watch controller 
2. Add documentation around Reconcile and why to choose it
3. Make operator development more streamlined
4. Update existing docs
