# Using Alias Child Logger in Actions

You can use the Alias function to include a user-defined alias in the logs for Mutate, Validate, and Watch actions. This can make for easier debugging since your user-defined alias will be included in the action's logs. This is especially useful when you have multiple actions of the same type in a single module.

For example, the below capability uses Mutate, Validate, and Watch actions with the Alias function:

```typescript
When(a.Pod)
  .IsCreatedOrUpdated()
  .InNamespace("pepr-demo")
  .WithLabel("pepr-test-pod")
  .Alias("reject:pods:runAsRoot:privileged:runAsGroup:allowPrivilegeEscalation")
  .Mutate(async (po, logger) => {
    logger.info(`Pod ${po.Raw.metadata?.name} is being mutated.`);
  })
  .Validate((request, logger) => {
    logger.info(`Pod ${request.Raw.metadata?.name} is being validated`);
    return request.Approve();
  })
  .Watch((po, phase, logger) => {
    logger.info(`Pod ${po.metadata?.name} is being watched in ${phase}.`);
  });
```

This will result in log entries that include the alias:

```bash
{"level":30,"time":1726518117378,"pid":16,"hostname":"pepr-static-test-78d87cbd99-48xpn","uid":"bba25f64-7ab8-480a-b00d-6053ceb386f5","namespace":"pepr-demo","name":"/pepr-test","gvk":{"group":"","version":"v1","kind":"Pod"},"operation":"CREATE","admissionKind":"Mutate","msg":"Incoming request"}
{"level":30,"time":1726518117378,"pid":16,"hostname":"pepr-static-test-78d87cbd99-48xpn","uid":"bba25f64-7ab8-480a-b00d-6053ceb386f5","namespace":"pepr-demo","name":"/pepr-test","msg":"Processing request"}
{"level":30,"time":1726518117379,"pid":16,"hostname":"pepr-static-test-78d87cbd99-48xpn","msg":"Executing mutation action with alias: reject:pods:runAsRoot:privileged:runAsGroup:allowPrivilegeEscalation"}
{"level":30,"time":1726518117379,"pid":16,"hostname":"pepr-static-test-78d87cbd99-48xpn","alias":"reject:pods:runAsRoot:privileged:runAsGroup:allowPrivilegeEscalation","msg":"Pod pepr-test is being mutated."}
{"level":30,"time":1726518117379,"pid":16,"hostname":"pepr-static-test-78d87cbd99-48xpn","uid":"bba25f64-7ab8-480a-b00d-6053ceb386f5","namespace":"pepr-demo","name":"hello-pepr","msg":"Mutation action succeeded (mutateCallback)"}
{"level":30,"time":1726518117379,"pid":16,"hostname":"pepr-static-test-78d87cbd99-48xpn","uid":"bba25f64-7ab8-480a-b00d-6053ceb386f5","namespace":"pepr-demo","name":"/pepr-test","res":{"uid":"bba25f64-7ab8-480a-b00d-6053ceb386f5","allowed":true,"patchType":"JSONPatch","patch":"W3sib3AiOiJhZGQiLCJwYXRoIjoiL21ldGFkYXRhL2Fubm90YXRpb25zL3N0YXRpYy10ZXN0LnBlcHIuZGV2fjFoZWxsby1wZXByIiwidmFsdWUiOiJzdWNjZWVkZWQifV0="},"msg":"Check response"}
{"level":30,"time":1726518117379,"pid":16,"hostname":"pepr-static-test-78d87cbd99-48xpn","uid":"bba25f64-7ab8-480a-b00d-6053ceb386f5","method":"POST","url":"/mutate/a603ef202f4b9e33e626c12a4840964d46dd83133a2a9ad9e7ba6f015861543f?timeout=10s","status":200,"duration":"1 ms"}
{"level":30,"time":1726518117381,"pid":16,"hostname":"pepr-static-test-78d87cbd99-48xpn","uid":"e57b7c91-92b9-445f-a36a-e5e15e3fe573","namespace":"pepr-demo","name":"/pepr-test","gvk":{"group":"","version":"v1","kind":"Pod"},"operation":"CREATE","admissionKind":"Validate","msg":"Incoming request"}
{"level":30,"time":1726518117381,"pid":16,"hostname":"pepr-static-test-78d87cbd99-48xpn","uid":"e57b7c91-92b9-445f-a36a-e5e15e3fe573","namespace":"pepr-demo","name":"/pepr-test","msg":"Processing validation request"}
{"level":30,"time":1726518117381,"pid":16,"hostname":"pepr-static-test-78d87cbd99-48xpn","uid":"e57b7c91-92b9-445f-a36a-e5e15e3fe573","namespace":"pepr-demo","name":"hello-pepr","msg":"Processing validation action (validateCallback)"}
{"level":30,"time":1726518117381,"pid":16,"hostname":"pepr-static-test-78d87cbd99-48xpn","msg":"Executing validate action with alias: reject:pods:runAsRoot:privileged:runAsGroup:allowPrivilegeEscalation"}
{"level":30,"time":1726518117381,"pid":16,"hostname":"pepr-static-test-78d87cbd99-48xpn","alias":"reject:pods:runAsRoot:privileged:runAsGroup:allowPrivilegeEscalation","msg":"Pod pepr-test is being validated"}
{"level":30,"time":1726518117381,"pid":16,"hostname":"pepr-static-test-78d87cbd99-48xpn","uid":"e57b7c91-92b9-445f-a36a-e5e15e3fe573","namespace":"pepr-demo","name":"hello-pepr","msg":"Validation action complete (validateCallback): allowed"}
{"level":30,"time":1726518117381,"pid":16,"hostname":"pepr-static-test-78d87cbd99-48xpn","uid":"e57b7c91-92b9-445f-a36a-e5e15e3fe573","namespace":"pepr-demo","name":"/pepr-test","res":{"uid":"e57b7c91-92b9-445f-a36a-e5e15e3fe573","allowed":true},"msg":"Check response"}
{"level":30,"time":1726518117381,"pid":16,"hostname":"pepr-static-test-78d87cbd99-48xpn","uid":"e57b7c91-92b9-445f-a36a-e5e15e3fe573","method":"POST","url":"/validate/a603ef202f4b9e33e626c12a4840964d46dd83133a2a9ad9e7ba6f015861543f?timeout=10s","status":200,"duration":"0 ms"}
```

and

```bash
{"level":30,"time":1726518117383,"pid":16,"hostname":"pepr-static-test-watcher-746fc6897c-kgbrv","msg":"Executing watch action with alias: reject:pods:runAsRoot:privileged:runAsGroup:allowPrivilegeEscalation"}
{"level":30,"time":1726518117383,"pid":16,"hostname":"pepr-static-test-watcher-746fc6897c-kgbrv","alias":"reject:pods:runAsRoot:privileged:runAsGroup:allowPrivilegeEscalation","msg":"Pod pepr-test is being watched in ADDED."}
{"level":30,"time":1726518117384,"pid":16,"hostname":"pepr-static-test-watcher-746fc6897c-kgbrv","msg":"Executing watch action with alias: reject:pods:runAsRoot:privileged:runAsGroup:allowPrivilegeEscalation"}
{"level":30,"time":1726518117384,"pid":16,"hostname":"pepr-static-test-watcher-746fc6897c-kgbrv","alias":"reject:pods:runAsRoot:privileged:runAsGroup:allowPrivilegeEscalation","msg":"Pod pepr-test is being watched in MODIFIED."}
{"level":30,"time":1726518117392,"pid":16,"hostname":"pepr-static-test-watcher-746fc6897c-kgbrv","msg":"Executing watch action with alias: reject:pods:runAsRoot:privileged:runAsGroup:allowPrivilegeEscalation"}
{"level":30,"time":1726518117392,"pid":16,"hostname":"pepr-static-test-watcher-746fc6897c-kgbrv","alias":"reject:pods:runAsRoot:privileged:runAsGroup:allowPrivilegeEscalation","msg":"Pod pepr-test is being watched in MODIFIED."}
{"level":30,"time":1726518123934,"pid":16,"hostname":"pepr-static-test-watcher-746fc6897c-kgbrv","msg":"Executing watch action with alias: reject:pods:runAsRoot:privileged:runAsGroup:allowPrivilegeEscalation"}
{"level":30,"time":1726518123934,"pid":16,"hostname":"pepr-static-test-watcher-746fc6897c-kgbrv","alias":"reject:pods:runAsRoot:privileged:runAsGroup:allowPrivilegeEscalation","msg":"Pod pepr-test is being watched in MODIFIED."}
```

**Note:** The Alias function is optional and can be used to provide additional context in the logs. You must pass the logger object as shown above to the action to use the Alias function.

## See Also

Looking for some more generic helpers? Check out the [Module Author SDK](../130_sdk.md) for information on other things that Pepr can help with.
