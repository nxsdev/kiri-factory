# FAQ

## Why does `kiri-factory` stay narrow?

Because the goal is readable test row creation, not a second seeding framework.

The package focuses on:

- one-row and small-batch setup
- explicit foreign-key values for known parent rows
- shared per-table definitions through `defineFactory(...)`
- named variants through `traits`
- schema-driven inference with visible boundaries

It intentionally does not hide every multi-row scenario behind a larger DSL.

## When should I use `drizzle-seed` instead?

Use `drizzle-seed` when you want large bulk datasets, weighted random data, or
the official `with` seeding flow.

Use `kiri-factory` when a test wants a few explicit rows and immediate return
values from `create()`.

## Why no automatic transaction around `create()`?

Because the correct transaction boundary depends on the caller. Wrap related
setup in your own `db.transaction(...)` when parent and child inserts must roll
back together.

## Why no nested DSL for child trees?

Plain Drizzle rows plus explicit steps keep foreign-key ownership visible and
failure messages close to the table being created. For larger fixture trees,
app-local helper functions usually stay clearer than a general nested DSL.

## Can I share `columns(f)` with `drizzle-seed`?

Yes. That is one of the main reasons `defineFactory(..., { columns })` exists.

```ts
const customerFactory = defineFactory(customers, {
  columns: (f) => ({
    companyName: f.companyName(),
    contactEmail: f.email(),
  }),
});

await seed(db, schema).refine((f) => ({
  customers: {
    count: 100,
    columns: customerFactory.columns(f),
  },
}));
```
