# Recipes

Concrete patterns for real-world test suites.

See also:

- [Docs index](../README.md)
- [Relations and graph returns](../relations.md)
- [Many-to-many patterns](../many-to-many.md)
- [Adapters, dialects, and runtime behavior](../adapters.md)

## Recipes

- [Many-to-many with required through-table payload](./through-payload.md)
- [Composite foreign keys](./composite-foreign-keys.md)
- [Custom adapter with insert + read-back](./custom-readback-adapter.md)
- [Reusing existing rows inside graph flows](./existing-and-graph.md)
- [Shared definitions in large test suites](./shared-definitions.md)
- [Wrapping graph creation in a transaction](./transactions.md)

## Which Recipe Should I Read?

- through table has required columns: [Many-to-many with required through-table payload](./through-payload.md)
- child rows depend on two or more foreign-key columns: [Composite foreign keys](./composite-foreign-keys.md)
- driver does not support `returning()`: [Custom adapter with insert + read-back](./custom-readback-adapter.md)
- one parent row should be shared across many graph calls: [Reusing existing rows inside graph flows](./existing-and-graph.md)
- you have hundreds or thousands of real DB tests: [Shared definitions in large test suites](./shared-definitions.md)
- graph writes must be atomic: [Wrapping graph creation in a transaction](./transactions.md)
