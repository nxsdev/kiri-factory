# Adapters, Dialects, and Runtime Behavior

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
  tables: { users },
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

- PostgreSQL tables with PGlite, including nested graph returns
- MySQL tables with a custom adapter for relation planning flows
- SQLite tables with a custom adapter for has-one flows, graph returns, and simple `CHECK` parsing

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

## Graph Writes Are Not Transactional By Default

`createGraph()` and `createGraphList()` are not wrapped in a transaction automatically.

If a nested create fails midway, earlier rows may already be persisted.

If your tests need atomic graph creation, wrap factory calls in your own transaction strategy.

If you need to understand what values are inferred before persistence, continue with [Inference and `CHECK` support](./inference.md).  
If you want the supported feature matrix, continue with [Compatibility and limits](./compatibility.md).
