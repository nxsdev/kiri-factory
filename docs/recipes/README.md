# Recipes

Concrete patterns for real-world test suites.

See also:

- [Docs index](../README.md)
- [Relations](../relations.md)
- [Many-to-many patterns](../many-to-many.md)
- [Adapters and transactions](../adapters.md)

## Recipes

- [Many-to-many with required through-table payload](./through-payload.md)
- [Composite foreign keys](./composite-foreign-keys.md)
- [Custom adapter with insert + read-back](./custom-readback-adapter.md)
- [Reusing parent rows](./existing-and-graph.md)
- [Shared definitions in large test suites](./shared-definitions.md)
- [Wrapping factory setup in a transaction](./transactions.md)

## Which Recipe Should I Read?

- through table has required columns: [Many-to-many with required through-table payload](./through-payload.md)
- child rows depend on two or more foreign-key columns: [Composite foreign keys](./composite-foreign-keys.md)
- driver does not support `returning()`: [Custom adapter with insert + read-back](./custom-readback-adapter.md)
- one parent row should be shared across many creates: [Reusing parent rows](./existing-and-graph.md)
- you have hundreds or thousands of real DB tests: [Shared definitions in large test suites](./shared-definitions.md)
- setup must be atomic: [Wrapping factory setup in a transaction](./transactions.md)
