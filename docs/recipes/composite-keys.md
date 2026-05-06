# Composite Keys

Composite foreign keys are supported through explicit overrides.

They are not auto-created generically.

## Example

```ts
const version = await factories.orderVersions.create({
  orderId: 1,
  version: 1,
  note: "first",
});

const line = await factories.orderVersionLines.create({
  orderId: version.orderId,
  version: version.version,
  sku: "SKU-1",
});
```

Pass every owned foreign-key column:

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
