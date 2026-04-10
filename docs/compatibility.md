# Compatibility and Limits

See also:

- [Docs index](./README.md)
- [Getting started](./getting-started.md)
- [Many-to-many patterns](./many-to-many.md)
- [Inference and `CHECK` support](./inference.md)

`kiri-factory` is intentionally broad, but not magical.

## Support Matrix

| Feature                                                        | Status          | Notes                                                         |
| -------------------------------------------------------------- | --------------- | ------------------------------------------------------------- |
| PostgreSQL / MySQL / SQLite tables                             | Supported       | main target for schema-driven inference                       |
| `pgSchema(...)`, `mysqlSchema(...)`, `sqliteTableCreator(...)` | Supported       | metadata is preserved                                         |
| stable `relations(...)`                                        | Supported       | typed `for(...)`, `hasOne(...)`, `hasMany(...)`               |
| `defineRelations(...)` via `kiri-factory/rqb-v2`               | Supported       | direct many-to-many planning included                         |
| self relations and same-target relations                       | Supported       | use relation keys, not table names                            |
| junction tables and composite primary keys                     | Supported       | preferred many-to-many path in stable Drizzle                 |
| simple single-column `CHECK`                                   | Best effort     | `>`, `>=`, `<`, `<=`, `BETWEEN`, `IN (...)`                   |
| `customType(...)`                                              | Resolver-driven | add inference resolvers where needed                          |
| composite foreign keys                                         | Partial         | explicit relation planning works better than generic fallback |
| complex `CHECK` SQL                                            | Manual override | use `state(...)`, overrides, or resolvers                     |
| polymorphic relations                                          | Out of scope    | not part of `v0.1`                                            |

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
- your through table carries required payload columns
- your custom types need domain-specific values

If your main concern is many-to-many API choice, continue with [Many-to-many patterns](./many-to-many.md).  
If your main concern is inferred values and `CHECK` behavior, continue with [Inference and `CHECK` support](./inference.md).
