# Transactions And Rollback

Auto-parent creation is not wrapped in an automatic transaction.

If you want the parent and child rows to succeed or fail together, own the transaction
at the call site.

## Pattern

```ts
await db.transaction(async (tx) => {
  const factories = createFactories({
    db: tx,
    schema,
  });

  const session = await factories.sessions.create({
    token: "inside-tx",
  });

  expect(session.id).toBeDefined();
  throw new Error("roll back");
});
```

The exact transaction API depends on the Drizzle driver.
The important part is that the factory runtime receives the transactional `db`.

## When This Matters

Use this pattern when:

- auto-created parents should roll back with the child
- you are testing unique or foreign-key failures
- your adapter does more than one database operation per create

## Continue With

- [Adapters and transactions](../adapters.md)
- [Multi-tenant auto-parents](./multi-tenant.md)
