# Wrapping Factory Setup In A Transaction

See also:

- [Recipes](./README.md)
- [Adapters and transactions](../adapters.md)
- [Relations](../relations.md)

`create()` and `createMany()` are not wrapped in a transaction automatically.

If your setup must be atomic, wrap the whole sequence yourself.

## Example

```ts
await db.transaction(async (tx) => {
  const factories = createFactories({
    db: tx,
    schema,
  });

  const user = await factories.users.create({
    email: "graph@example.com",
    nickname: "graph",
  });

  await factories.posts.for("author", user).createMany(2);
  await factories.sessions.for("user", user).create();
});
```

## When To Do This

- setup must succeed or fail as one unit
- partial writes make later assertions noisy
- the same test creates several dependent rows before the actual assertion

## When You May Not Need It

- each test already runs inside a rollback sandbox
- partial writes are acceptable inside setup helpers
- you want the simplest possible call site
