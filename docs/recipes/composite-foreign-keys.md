# Composite Foreign Keys

See also:

- [Recipes](./README.md)
- [Relations](../relations.md)
- [Compatibility and limits](../compatibility.md)

Composite foreign keys work best when you use explicit relation planning.

## Let The Relation Fill The Whole Key

```ts
const version = await factories.orderVersions.create({
  orderId: 100,
  version: 3,
});

const line = await factories.orderVersionLines.for("orderVersion", version).create({
  sku: "SKU-1",
});
```

When relation metadata knows every owned key, `for("orderVersion", version)` copies the full composite key from the parent row.

## When To Avoid Plain `create()`

```ts
const factories = createFactories({
  db,
  schema: { orderVersions, orderVersionLines },
});

await factories.orderVersionLines.create();
```

This style is intentionally too weak for composite foreign keys. Use an explicit parent row or override the full key directly instead.
