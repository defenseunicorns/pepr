# Using Alias Child Logger in Actions

You can use the Alias function to include a user-defined alias in the logs for Mutate, Validate, and Watch actions. This can make for easier debugging since your user-defined alias will be included in the action's logs. This is especially useful when you have multiple actions of the same type in a single module.

The below example uses Mutate, Validate, and Watch actions with the Alias function:

```ts
When(a.Pod)
  .IsCreatedOrUpdated()
  .Alias("mutate")
  .Mutate((po, logger) => {
    logger.info(`alias: mutate ${po.Raw.metadata.name}`);
  });
When(a.Pod)
  .IsCreatedOrUpdated()
  .Alias("validate")
  .Validate((po, logger) => {
    logger.info(`alias: validate ${po.Raw.metadata.name}`);
    return po.Approve();
  });
When(a.Pod)
  .IsCreatedOrUpdated()
  .Alias("watch")
  .Watch((po, _, logger) => {
    logger.info(`alias: watch ${po.metadata.name}`);
  });
When(a.Pod)
  .IsCreatedOrUpdated()
  .Alias("reconcile")
  .Reconcile((po, _, logger) => {
    logger.info(`alias: reconcile ${po.metadata.name}`);
  });
```

This will result in log entries when creating a Pod with the that include the alias:

**Logs for Mutate When Pod `red` is Created:**

```bash
{"level":30,"time":1726632368808,"pid":16,"hostname":"pepr-static-test-6786948977-6hbnt","uid":"b2221631-e87c-41a2-94c8-cdaef15e7b5f","namespace":"pepr-demo","name":"/red","gvk":{"group":"","version":"v1","kind":"Pod"},"operation":"CREATE","admissionKind":"Mutate","msg":"Incoming request"}
{"level":30,"time":1726632368808,"pid":16,"hostname":"pepr-static-test-6786948977-6hbnt","uid":"b2221631-e87c-41a2-94c8-cdaef15e7b5f","namespace":"pepr-demo","name":"/red","msg":"Processing request"}
{"level":30,"time":1726632368808,"pid":16,"hostname":"pepr-static-test-6786948977-6hbnt","msg":"Executing mutation action with alias: mutate"}
{"level":30,"time":1726632368808,"pid":16,"hostname":"pepr-static-test-6786948977-6hbnt","alias":"mutate","msg":"alias: mutate red"}
{"level":30,"time":1726632368808,"pid":16,"hostname":"pepr-static-test-6786948977-6hbnt","uid":"b2221631-e87c-41a2-94c8-cdaef15e7b5f","namespace":"pepr-demo","name":"hello-pepr","msg":"Mutation action succeeded (mutateCallback)"}
{"level":30,"time":1726632368808,"pid":16,"hostname":"pepr-static-test-6786948977-6hbnt","uid":"b2221631-e87c-41a2-94c8-cdaef15e7b5f","namespace":"pepr-demo","name":"/red","res":{"uid":"b2221631-e87c-41a2-94c8-cdaef15e7b5f","allowed":true,"patchType":"JSONPatch","patch":"W3sib3AiOiJhZGQiLCJwYXRoIjoiL21ldGFkYXRhL2Fubm90YXRpb25zL3N0YXRpYy10ZXN0LnBlcHIuZGV2fjFoZWxsby1wZXByIiwidmFsdWUiOiJzdWNjZWVkZWQifV0="},"msg":"Check response"}
{"level":30,"time":1726632368809,"pid":16,"hostname":"pepr-static-test-6786948977-6hbnt","uid":"b2221631-e87c-41a2-94c8-cdaef15e7b5f","method":"POST","url":"/mutate/c1a7fb6e3f2ab9dc08909d2de4166987520f317d53b759ab882dfd0b1c198479?timeout=10s","status":200,"duration":"1 ms"}
```

**Logs for Validate When Pod `red` is Created:**

```bash
{"level":30,"time":1726631437605,"pid":16,"hostname":"pepr-static-test-6786948977-j7f9h","uid":"731eff93-d457-4ffc-a98c-0bcbe4c1727a","namespace":"pepr-demo","name":"/red","gvk":{"group":"","version":"v1","kind":"Pod"},"operation":"CREATE","admissionKind":"Validate","msg":"Incoming request"}
{"level":30,"time":1726631437606,"pid":16,"hostname":"pepr-static-test-6786948977-j7f9h","uid":"731eff93-d457-4ffc-a98c-0bcbe4c1727a","namespace":"pepr-demo","name":"/red","msg":"Processing validation request"}
{"level":30,"time":1726631437606,"pid":16,"hostname":"pepr-static-test-6786948977-j7f9h","uid":"731eff93-d457-4ffc-a98c-0bcbe4c1727a","namespace":"pepr-demo","name":"hello-pepr","msg":"Processing validation action (validateCallback)"}
{"level":30,"time":1726631437606,"pid":16,"hostname":"pepr-static-test-6786948977-j7f9h","msg":"Executing validate action with alias: validate"}
{"level":30,"time":1726631437606,"pid":16,"hostname":"pepr-static-test-6786948977-j7f9h","alias":"validate","msg":"alias: validate red"}
{"level":30,"time":1726631437606,"pid":16,"hostname":"pepr-static-test-6786948977-j7f9h","uid":"731eff93-d457-4ffc-a98c-0bcbe4c1727a","namespace":"pepr-demo","name":"hello-pepr","msg":"Validation action complete (validateCallback): allowed"}
{"level":30,"time":1726631437606,"pid":16,"hostname":"pepr-static-test-6786948977-j7f9h","uid":"731eff93-d457-4ffc-a98c-0bcbe4c1727a","namespace":"pepr-demo","name":"/red","res":{"uid":"731eff93-d457-4ffc-a98c-0bcbe4c1727a","allowed":true},"msg":"Check response"}
{"level":30,"time":1726631437606,"pid":16,"hostname":"pepr-static-test-6786948977-j7f9h","uid":"731eff93-d457-4ffc-a98c-0bcbe4c1727a","method":"POST","url":"/validate/c1a7fb6e3f2ab9dc08909d2de4166987520f317d53b759ab882dfd0b1c198479?timeout=10s","status":200,"duration":"5 ms"}
```

**Logs for Watch and Reconcile When Pod `red` is Created:**

```bash
{"level":30,"time":1726798504518,"pid":16,"hostname":"pepr-static-test-watcher-6dc69654c9-5ql6b","msg":"Executing reconcile action with alias: reconcile"}
{"level":30,"time":1726798504518,"pid":16,"hostname":"pepr-static-test-watcher-6dc69654c9-5ql6b","alias":"reconcile","msg":"alias: reconcile red"}
{"level":30,"time":1726798504518,"pid":16,"hostname":"pepr-static-test-watcher-6dc69654c9-5ql6b","msg":"Executing watch action with alias: watch"}
{"level":30,"time":1726798504518,"pid":16,"hostname":"pepr-static-test-watcher-6dc69654c9-5ql6b","alias":"watch","msg":"alias: watch red"}
{"level":30,"time":1726798504521,"pid":16,"hostname":"pepr-static-test-watcher-6dc69654c9-5ql6b","msg":"Executing reconcile action with alias: reconcile"}
{"level":30,"time":1726798504521,"pid":16,"hostname":"pepr-static-test-watcher-6dc69654c9-5ql6b","alias":"reconcile","msg":"alias: reconcile red"}
{"level":30,"time":1726798504521,"pid":16,"hostname":"pepr-static-test-watcher-6dc69654c9-5ql6b","msg":"Executing watch action with alias: watch"}
{"level":30,"time":1726798504521,"pid":16,"hostname":"pepr-static-test-watcher-6dc69654c9-5ql6b","alias":"watch","msg":"alias: watch red"}
{"level":30,"time":1726798504528,"pid":16,"hostname":"pepr-static-test-watcher-6dc69654c9-5ql6b","msg":"Executing reconcile action with alias: reconcile"}
{"level":30,"time":1726798504528,"pid":16,"hostname":"pepr-static-test-watcher-6dc69654c9-5ql6b","alias":"reconcile","msg":"alias: reconcile red"}
{"level":30,"time":1726798504528,"pid":16,"hostname":"pepr-static-test-watcher-6dc69654c9-5ql6b","msg":"Executing watch action with alias: watch"}
{"level":30,"time":1726798504528,"pid":16,"hostname":"pepr-static-test-watcher-6dc69654c9-5ql6b","alias":"watch","msg":"alias: watch red"}
{"level":30,"time":1726798510464,"pid":16,"hostname":"pepr-static-test-watcher-6dc69654c9-5ql6b","msg":"Executing watch action with alias: watch"}
{"level":30,"time":1726798510464,"pid":16,"hostname":"pepr-static-test-watcher-6dc69654c9-5ql6b","alias":"watch","msg":"alias: watch red"}
{"level":30,"time":1726798510466,"pid":16,"hostname":"pepr-static-test-watcher-6dc69654c9-5ql6b","msg":"Executing reconcile action with alias: reconcile"}
{"level":30,"time":1726798510466,"pid":16,"hostname":"pepr-static-test-watcher-6dc69654c9-5ql6b","alias":"reconcile","msg":"alias: reconcile red"}
```

> [!NOTE]
> The Alias function is optional and can be used to provide additional context in the logs.
> You must pass the logger object as shown above to the action to use the Alias function.

## See Also

Looking for some more generic helpers? Check out the [Module Author SDK](../user-guide/sdk.md) for information on other things that Pepr can help with.
