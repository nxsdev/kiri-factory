# Compatibility and Limits

See also:

- [Docs index](./README.md)
- [Getting started](./getting-started.md)
- [Many-to-many patterns](./many-to-many.md)
- [Inference and `CHECK` support](./inference.md)

`kiri-factory` is intentionally broad, but not magical.

## Support Matrix

| Feature                                                        | Status          | Notes                                                     |
| -------------------------------------------------------------- | --------------- | --------------------------------------------------------- |
| PostgreSQL / MySQL / SQLite tables                             | Supported       | main target for schema-driven inference                   |
| `pgSchema(...)`, `mysqlSchema(...)`, `sqliteTableCreator(...)` | Supported       | metadata is preserved                                     |
| stable `relations(...)`                                        | Supported       | typed `for(...)`, `hasOne(...)`, `hasMany(...)`           |
| `defineRelations(...)` via `kiri-factory/rqb-v2`               | Supported       | direct many-to-many planning included                     |
| self relations and same-target relations                       | Supported       | use relation keys, not table names                        |
| junction tables and composite primary keys                     | Supported       | preferred many-to-many path in stable Drizzle             |
| simple single-column `CHECK`                                   | Best effort     | `>`, `>=`, `<`, `<=`, `BETWEEN`, `IN (...)`               |
| `customType(...)`                                              | Resolver-driven | add inference resolvers where needed                      |
| composite foreign keys                                         | Explicit only   | generic FK auto-create does not support multi-column keys |
| complex `CHECK` SQL                                            | Manual override | use `state(...)`, overrides, or resolvers                 |
| polymorphic relations                                          | Out of scope    | not part of `v0.1`                                        |

## What This Library Does Not Try To Do

`kiri-factory` is not trying to be:

- a bulk seeding replacement for `drizzle-seed`
- a general-purpose SQL parser for arbitrary business logic
- a polymorphic relation framework
- a universal persistence abstraction for every Drizzle driver without adapters

## Practical Guidance

Use `kiri-factory` when you want:

- readable test setup
- schema-driven defaults
- reusable test data definitions
- relation-aware graphs

Use explicit factory logic when:

- your business rules are encoded in complex SQL
- your child row depends on a composite foreign key
- your through table carries required payload columns
- your custom types need domain-specific values

## Composite Foreign Keys

`kiri-factory` can plan composite-key relations when you use explicit relation APIs such as `for(...)`, `hasOne(...)`, and `hasMany(...)`.

What does not work generically is the narrow table-only fallback:

- `createFactories({ db, tables })`
- missing parent keys auto-created from raw foreign-key metadata

That fallback only auto-creates single-column foreign keys.

If your child row depends on multiple columns:

- prefer relation-aware runtimes with exported Drizzle relations
- or create the parent first and pass it through `existing(...)`
- or override the full key directly

For a concrete pattern, continue with [Composite foreign keys](./recipes/composite-foreign-keys.md).

## Complex Constraints

`kiri-factory` only parses simple single-column `CHECK` constraints.

If your schema depends on:

- multi-column `CHECK`
- driver functions inside `CHECK`
- business rules encoded in arbitrary SQL
- `customType(...)` values that need domain-aware data

then treat inference as a starting point, not the source of truth.

In those cases, prefer:

- `state(...)`
- call-time overrides
- runtime or definition-level inference resolvers

If your main concern is custom persistence or read-back behavior, continue with [Adapters, dialects, and runtime behavior](./adapters.md).

If your main concern is many-to-many API choice, continue with [Many-to-many patterns](./many-to-many.md).  
If your main concern is inferred values and `CHECK` behavior, continue with [Inference and `CHECK` support](./inference.md).
