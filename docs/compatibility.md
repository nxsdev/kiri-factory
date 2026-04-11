# Compatibility and Limits

See also:

- [Docs index](./README.md)
- [Relations](./relations.md)
- [Adapters and transactions](./adapters.md)
- [Inference and `CHECK` guardrails](./inference.md)

`kiri-factory` is intentionally broad, but not magical.

## Support Matrix

| Feature                                                        | Status          | Notes                                                          |
| -------------------------------------------------------------- | --------------- | -------------------------------------------------------------- |
| PostgreSQL / MySQL / SQLite tables                             | Supported       | main target for schema-driven inference                        |
| `pgSchema(...)`, `mysqlSchema(...)`, `sqliteTableCreator(...)` | Supported       | metadata is preserved                                          |
| stable `relations(...)`                                        | Supported       | typed `for(...)` on child-side one-relations                   |
| `defineRelations(...)` via `kiri-factory/rqb-v2`               | Supported       | typed `for(...)` on child-side one-relations                   |
| self relations and same-target relations                       | Supported       | use relation keys, not table names                             |
| junction tables and composite primary keys                     | Supported       | preferred many-to-many path                                    |
| simple single-column `CHECK`                                   | Guardrail only  | parsed to reject invalid generated values, not to invent them  |
| `customType(...)`                                              | Resolver-driven | add inference resolvers where needed                           |
| official `drizzle-seed`-supported PG/MySQL/SQLite selectors    | Supported       | auto generation follows official selector logic where possible |
| official generators outside the auto selector                  | Explicit only   | use `columns(f)`; generator existence alone is not enough      |
| single-column unique + shared `columns(f)`                     | Supported       | unique-safe `drizzle-seed` generators are enforced             |
| composite foreign keys                                         | Explicit only   | use `for(...)` with an existing parent row or direct overrides |
| compound / partial / expression unique constraints             | Explicit only   | do not rely on generic auto-generation                         |
| direct many-to-many writes without a through row               | Not supported   | create the junction row explicitly                             |
| complex `CHECK` SQL                                            | Manual override | use `columns(f)`, overrides, or resolvers                      |
| polymorphic relations                                          | Out of scope    | not part of `v0.1`                                             |

## What This Library Does Not Try To Do

`kiri-factory` is not trying to be:

- a bulk seeding replacement for `drizzle-seed`
- a general-purpose SQL parser for arbitrary business logic
- a polymorphic relation framework
- a deep graph DSL that hides every intermediate row

## Practical Guidance

Use `kiri-factory` when you want:

- readable test setup
- schema-driven defaults
- reusable factory definitions
- relation-aware row creation

Use explicit factory logic when:

- your business rules are encoded in complex SQL
- your child row depends on a composite foreign key
- your through table carries required payload columns
- your table has compound, partial, or expression-based unique constraints
- your custom types need domain-specific values
- your type has an official generator but the official auto selector does not treat it as a safe generic default

## Composite Foreign Keys

`kiri-factory` can copy composite keys when you use explicit relation planning with `for(...)` and relation metadata.

What does not work generically is implicit parent invention from plain `create()`:

- missing parent keys guessed from foreign-key metadata
- multi-column foreign keys inferred without an explicit parent row

If your child row depends on multiple columns:

- create the parent first
- pass that row to `for(...)`
- or override the full key directly

## Complex Constraints

Non-trivial uniqueness falls into the same bucket:

- compound unique groups
- partial unique indexes
- expression-based unique indexes

`kiri-factory` does not try to prove those safe from generic auto-generated values.
Set the participating columns explicitly through:

- `columns(f)`
- `for(...)`
- call-site overrides

Then use `verifyCreates()` against a disposable database when you want real insert coverage.

This is an intentional boundary.

For non-trivial unique constraints, the factory should help you express the rows clearly,
not pretend it can outsmart the database.

`kiri-factory` only parses simple single-column `CHECK` constraints.

If your schema depends on:

- multi-column `CHECK`
- driver functions inside `CHECK`
- business rules encoded in arbitrary SQL
- `customType(...)` values that need domain-aware data, such as driver-specific `point` mappings
- types that official `drizzle-seed` selector logic does not support for that dialect
- types with official generator docs but known selector/runtime edge cases, such as some `geometry(point)` configurations

then treat inference as a starting point, not the source of truth.

In those cases, prefer:

- `columns(f)`
- call-time overrides
- runtime or definition-level inference resolvers
- `verifyCreates()` against a disposable database when you want real insert coverage

If your main concern is custom persistence or transaction boundaries, continue with [Adapters and transactions](./adapters.md).  
If your main concern is relation wiring patterns, continue with [Relations](./relations.md).
