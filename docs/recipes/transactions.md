# Wrapping Graph Creation In A Transaction

See also:

- [Recipes](./README.md)
- [Adapters, dialects, and runtime behavior](../adapters.md)
- [Relations and graph returns](../relations.md)

`createGraph()` is not transactional by default.

If your test setup needs atomic graph creation, wrap the factory call in your own transaction boundary.

## Example

```ts
await db.transaction(async (tx) => {
  const factories = createFactories({
    db: tx,
    schema,
  });

  await factories.users.hasMany("posts", 2).hasMany("sessions", 1).createGraph({
    email: "graph@example.com",
    nickname: "graph",
  });
});
```

## When To Do This

- setup must succeed or fail as one unit
- partial writes make later assertions noisy
- the same test creates deep graphs and intentionally triggers failures

## When You May Not Need It

- each test runs inside a rollback sandbox already
- partial writes are acceptable in setup helpers
- you want the simplest possible call site
