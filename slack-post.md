🚀 **Pepr Tip of the Day!** 🚀

Did you know Pepr's Alias Child Logger can make debugging a breeze? 🎯

With the `Alias` function, you can easily label your `Mutate`, `Validate`, and `Watch` actions for clearer logs! Perfect for when you've got multiple actions of the same type in a single module.

👀 **Here's a sneak peek of how it works:**
```ts
When(a.Pod)
  .IsCreatedOrUpdated()
  .Alias("mutate")
  .Mutate((po, logger) => {
    logger.info(`alias: mutate ${po.Raw.metadata.name}`);
  });
```

🗒️ **Logs will now show entries like:**
```bash
{"alias":"mutate","msg":"alias: mutate red"}
```

With this, you'll instantly know which action triggered your log entry. 💡

Check out the full details in the [docs](https://docs.pepr.dev/v0.37.2/user-guide/actions/using-alias-child-logger/), and start logging smarter with Pepr's Alias Child Logger! 🎉