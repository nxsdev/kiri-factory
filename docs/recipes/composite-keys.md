# Composite Keys

Composite foreign keys are supported through explicit `for(...)` calls.

They are not auto-created generically.

## Example

```ts
const version = await factories.orderVersions.create({
  orderId: 1,
  version: 1,
  note: "first",
});

const line = await factories.orderVersionLines.for("orderVersion", version).create({
  sku: "SKU-1",
});
```

`for("orderVersion", version)` copies both foreign-key columns:

- `orderId`
- `version`

## Why This Is Explicit

Composite keys usually need coordination across more than one column.
That is a good place to be direct rather than rely on inference.

## SQLite Variant

The same pattern is covered in the SQLite runtime test suite.

See `test/sqlite.test.ts`.

## Continue With

- [Relations](../relations.md)
- [Compatibility and limits](../compatibility.md)
