# Adapters and Transactions

See also:

- [Docs index](./README.md)
- [Getting started](./getting-started.md)
- [Inference and `CHECK` support](./inference.md)
- [Compatibility and limits](./compatibility.md)

## Default Persistence Adapter

The default adapter uses Drizzle's `insert(...).values(...).returning()` flow.

That means:

- it works well with drivers that support `returning()`
- for non-returning drivers, you should pass a custom adapter

## Custom Adapter

```ts
const factories = createFactories({
  db,
  schema: { users },
  adapter: {
    async create({ values }) {
      return values as typeof values & { id: number };
    },
  },
});
```

For real drivers without `returning()`, the usual pattern is:

1. insert the row
2. read it back with the driver's preferred API
3. return the persisted row

## Dialect Coverage

Tested in this repository:

- PostgreSQL tables with PGlite
- MySQL tables with a custom adapter
- SQLite tables with a custom adapter and simple `CHECK` parsing

Important distinction:

- relation planning and factory building are schema-level concerns
- persistence is adapter-specific

## `lint()`

You can ask a connected runtime to attempt building each entry once:

```ts
const issues = await factories.lint();
```

This is useful for catching factories that still need explicit build-time overrides.

`lint()` does not execute `create()`, so:

- adapter-specific persistence failures are out of scope
- create-time database errors are out of scope

## `verifyCreates()`

If you want a stronger validation pass, ask the runtime to try two real `create()` calls per factory:

```ts
const issues = await factories.verifyCreates();
```

Use this with a disposable database or transaction boundary.

`verifyCreates()` is useful for catching:

- adapter-specific persistence failures
- missing explicit parents after disabling implicit FK auto-create
- create-time constraint errors that `build()` cannot see
- simple sequence and unique issues that only show up after more than one insert
- duplicate explicit values on unique columns
- non-trivial unique/index cases that still need disposable-DB confirmation

## Transactions

`create()` and `createMany()` are not wrapped in a transaction automatically.

If your setup needs atomicity, wrap the sequence in your own transaction boundary.  
See [Wrapping factory setup in a transaction](./recipes/transactions.md).

If you need to understand what values are inferred before persistence, continue with [Inference and `CHECK` support](./inference.md).  
If you want the supported feature matrix, continue with [Compatibility and limits](./compatibility.md).
