# Troubleshooting

Start from the exact error message.

Most `kiri-factory` failures are boundary checks rather than hidden runtime behavior.

## `Factory for table "..." is not connected`

You called `create()` or `createMany()` on a plain definition.

Fix:

- use `createFactories({ db, schema | relations })`
- or call `build()` / `buildMany()` when you only want an in-memory row

## `createFactories(...) could not find any Drizzle tables in "schema"`

The stable entrypoint only looks for actual Drizzle table objects on `schema`.

Fix:

- pass the schema object that exports your tables
- do not pass only relation exports
- use `kiri-factory/rqb-v2` when your app is built around `defineRelations(...)`

## `Relation "..." is not available on "..."`

`for(...)` only works when the runtime knows the relation metadata.

Fix:

- stable entrypoint: pass a schema object that exports `relations(...)`
- rqb-v2 entrypoint: pass the object returned by `defineRelations(...)`
- confirm the relation name matches the child-side one-relation key

Continue with [Relations](./relations.md).

## `Relation "..." does not own the foreign key`

You called `for(...)` from the wrong side of the relation.

Fix:

- call `for(...)` on the child table, not the parent table
- or create the related row separately and set the foreign key explicitly

## `Relation "..." is already planned on this factory`

The same relation was passed to `for(...)` twice on one factory chain.

Fix:

- keep only one `for("relation", row)` call per relation key
- start from a fresh factory chain when you need a different parent row

## `Could not auto-resolve required columns for "..."`

Built-in inference could not safely fill one or more required columns.

Common reasons:

- composite foreign key
- unique constraint that needs explicit coordination
- custom type without a resolver
- required column with no supported default or generator

Fix:

- add a shared value with `columns(f)`
- add a call-site override
- use `for(...)` for relation-owned foreign keys
- add an inference resolver for custom types

Continue with [Defining factories](./define-factory.md) and [Inference](./inference.md).

## `Could not safely auto-resolve "..." because ... unique constraint ...`

The table has a complex unique rule that could not be proven safe from auto-generated values.

Fix:

- set all constrained columns explicitly
- prefer `columns(f)` for shared values
- then run `verifyCreates()` against a disposable database

## `Generated value for "...column" does not satisfy a simple CHECK constraint`

The row was inferred, but the final value conflicts with a supported single-column `CHECK`.

Fix:

- override the value directly
- add a `columns(f)` definition
- or add an inference resolver for that column or custom type

Continue with [Inference and `CHECK` guardrails](./inference.md).

## `Could not auto-create "..." because the foreign-key chain is cyclic`

Auto-parent creation found a loop.

Fix:

- break the chain with `for(...)`
- or set the foreign key columns explicitly
- or split the setup into several creates

Continue with [Relations](./relations.md).

## `Unknown definition key "..."` or `Unknown runtime factory "..."`

A registry key does not match the runtime table key.

Fix:

- ensure the `definitions` object uses the same keys as the runtime schema
- use `factories.get(table)` when you want table-instance lookup
- check for typos in property names

## `Table "..." is not registered in this runtime`

You called `factories.get(table)` with a table that was not part of the runtime.

Fix:

- include that table in `schema` or `relations`
- or create a separate runtime for that table set

## `The configured Drizzle driver for "..." does not support returning()`

The default adapter only works when `db.insert(...).values(...).returning()` is available.

Fix:

- keep using the default adapter on drivers with `returning()`
- use a custom `FactoryAdapter` on MySQL-style drivers
- or compose your own adapter around `drizzleReturning()` when only one path differs

Continue with [Adapters and transactions](./adapters.md).

## `Expected create() to return one row for "...", but received none`

The adapter completed, but no row came back.

Fix:

- verify your custom adapter returns the inserted row
- if you wrap `drizzleReturning()`, confirm the underlying driver really supports `returning()`

## `Expected a non-negative integer count`

`buildMany()` or `createMany()` received an invalid count.

Fix:

- pass `0` or a positive integer
- validate the count before it reaches the factory when it comes from a test helper

## Continue With

- [API reference](./api.md)
- [Adapters and transactions](./adapters.md)
- [Compatibility and limits](./compatibility.md)
