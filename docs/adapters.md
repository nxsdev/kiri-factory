# Adapters and Transactions

See also:

- [Docs index](./README.md)
- [Getting started](./getting-started.md)
- [Inference and `CHECK` guardrails](./inference.md)
- [Compatibility and limits](./compatibility.md)

## Default Persistence Adapter

The default adapter uses Drizzle's `insert(...).values(...).returning()` flow.

In practice, that means:

- PostgreSQL and SQLite fit the default adapter directly (both dialects expose `returning()` through their Drizzle wrappers)
- if your driver does not expose the inserted row through `returning()`, pass a custom adapter

Official references:

- [Drizzle insert docs](https://orm.drizzle.team/docs/insert)
- [Drizzle MySQL getting started](https://orm.drizzle.team/docs/get-started-mysql)

As of the current Drizzle docs:

- PostgreSQL and SQLite show normal `returning()` examples
- MySQL does not have native `RETURNING` for full inserted rows
- Drizzle offers `$returningId()` on MySQL when you only need inserted primary keys

So the rule is:

- you want the inserted row back and your stack supports `returning()`: default adapter is fine
- you only get inserted ids or driver-specific metadata back: use a custom adapter and read the row back yourself

### Reusing The Default Adapter Inside A Custom One

`drizzleReturning<DB>()` is also exported directly. This lets a custom adapter delegate the standard path and only intervene for a subset of tables:

```ts
import type { Table } from "drizzle-orm";
import { drizzleReturning, type FactoryAdapter } from "kiri-factory";

const fallback = drizzleReturning<typeof db>();

const adapter: FactoryAdapter<typeof db> = {
  async create(args) {
    if (args.table === legacyAuditTable) {
      return writeThroughLegacyApi(args);
    }
    return fallback.create(args);
  },
};

const factories = createFactories({ db, schema, adapter });
```

## Custom Adapter

```ts
import { eq } from "drizzle-orm";
import { createFactories } from "kiri-factory";

const factories = createFactories({
  db,
  schema: { users },
  adapter: {
    async create({ db, table, values }) {
      const result = await db.insert(table).values(values);
      const insertedId = extractInsertedId(result);
      const [row] = await db.select().from(table).where(eq(table.id, insertedId));
      return row!;
    },
  },
});
```

For real drivers without `returning()`, the usual pattern is:

1. insert the row
2. read it back with the driver's preferred API
3. return the persisted row

Use a custom adapter when:

- you use MySQL and want `create()` to return the full inserted row
- your driver returns inserted ids or metadata instead of row objects
- your primary key is available after insert, but the rest of the row must be queried

## Dialect Coverage

Tested in this repository:

- PostgreSQL via PGlite and the default adapter
- SQLite via libSQL and the default adapter
- MySQL via a custom adapter (the existing suite uses an echo adapter that stands in for a real MySQL driver)

Important distinction:

- relation planning and factory building are schema-level concerns
- persistence is adapter-specific

## `lint()` And `verifyCreates()`

Both helpers return the same shape:

```ts
interface FactoryLintIssue {
  key: string; // registry key, e.g. "users"
  table: string; // Drizzle runtime table name
  error: Error; // the failure from build() or createMany(2)
}
```

### `lint()`

Asks a connected runtime to attempt `build()` for every entry once:

```ts
const issues = await factories.lint();
```

This is useful for catching factories that still need explicit build-time overrides.

`lint()` does not execute `create()`, so:

- adapter-specific persistence failures are out of scope
- create-time database errors are out of scope

### `verifyCreates()`

If you want a stronger validation pass, ask the runtime to try a real `createMany(2)` per factory:

```ts
const issues = await factories.verifyCreates();
```

Use this with a disposable database or transaction boundary.

`verifyCreates()` is useful for catching:

- adapter-specific persistence failures
- unresolved parents that plain `create()` cannot auto-create
- create-time constraint errors that `build()` cannot see
- simple sequence and unique issues that only show up after more than one insert
- duplicate explicit values on unique columns
- non-trivial unique/index cases that still need disposable-DB confirmation

What it is not:

- a proof that every future insert will succeed
- a replacement for scenario-level tests
- a substitute for disposable-DB integration tests around complex constraints

## Transactions

`create()` and `createMany()` are not wrapped in a transaction automatically.

If your setup needs atomicity, wrap the sequence in your own transaction boundary.
This also applies to implicit parent creation: if a parent is auto-created and the
child insert fails later at database time, only your surrounding transaction can
guarantee rollback of both rows.

```ts
await db.transaction(async (tx) => {
  const factories = createFactories({
    db: tx,
    schema,
  });

  const user = await factories.users.create({
    email: "graph@example.com",
  });

  await factories.posts.createMany(2, (index) => ({
    authorId: user.id,
    title: `Post ${index + 1}`,
  }));
  await factories.sessions.create({
    userId: user.id,
  });
});
```

If you need to understand what values are inferred before persistence, continue with [Inference and `CHECK` guardrails](./inference.md).  
If you want the supported feature matrix, continue with [Compatibility and limits](./compatibility.md).
