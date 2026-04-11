# FAQ

## Why does `kiri-factory` stay narrow?

Because the goal is readable test row creation, not a second seeding framework.

The package focuses on:

- one-row and small-batch setup
- explicit relation wiring with `for(...)`
- shared per-table definitions through `defineFactory(...)`
- safe-ish inference, with visible boundaries

It intentionally does not try to hide every multi-row scenario behind a larger DSL.

## When should I use `drizzle-seed` instead?

Use `drizzle-seed` when you want:

- large bulk datasets
- the official seeding API itself
- the `with` seeding flow
- generator-driven refinement across many tables at once

Use `kiri-factory` when you want:

- a few rows for a test case
- relation wiring by relation name
- an inserted row returned immediately from `create()`
- shared table-local defaults without switching into a global seed script

## Why no automatic transaction around `create()`?

Because the correct transaction boundary depends on the caller.

Some tests want:

- one row at a time
- several related rows inside one transaction
- adapter-specific behavior
- rollback handled by the surrounding test harness

Instead of guessing, `kiri-factory` leaves transaction ownership to the caller.

Continue with [Adapters and transactions](./adapters.md).

## Why no nested DSL for child trees?

The package prefers plain Drizzle rows plus explicit steps.

That keeps:

- relation direction visible
- foreign-key ownership visible
- adapter behavior easy to reason about
- failure messages closer to the actual table being created

For larger fixture trees, app-local helpers usually stay clearer than a general nested DSL.

## Why no polymorphic relation support?

Because it is hard to make generic, type-safe, and explicit at the same time.

`kiri-factory` currently stays with ordinary Drizzle relations and explicit foreign-key
ownership.

If your schema needs polymorphic behavior, create the rows explicitly in app helpers.

## Why does `for(...)` only work on the child side?

Because only the child side owns the foreign key.

`for(...)` is meant to copy parent key values into the row being built or created.
On the parent side there is nothing to copy into the parent row.

## Why does `verifyCreates()` create two rows?

It is a cheap smoke test for real inserts.

Two rows are enough to catch common uniqueness and relation issues that a single insert
can miss.
It is still a validation helper, not a proof that every input combination is safe.

## Can I share `columns(f)` with `drizzle-seed`?

Yes.

That is one of the main reasons `defineFactory(..., { columns })` exists.

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

## Continue With

- [Getting started](./getting-started.md)
- [Defining factories](./define-factory.md)
- [Recipes](./recipes/README.md)
