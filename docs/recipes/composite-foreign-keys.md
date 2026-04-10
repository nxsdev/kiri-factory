# Composite Foreign Keys

See also:

- [Recipes](./README.md)
- [Relations and graph returns](../relations.md)
- [Compatibility and limits](../compatibility.md)

Composite foreign keys work best when you use explicit relation planning.

The narrow table-only fallback only auto-creates single-column parents. If one child row depends on two or more foreign-key columns, plan the edge with `for(...)` or create the parent first and reuse it with `existing(...)`.

## Child Side: Let The Relation Fill The Whole Key

```ts
const line = await factories.orderVersionLines.for("orderVersion").create({
  sku: "SKU-1",
});
```

When the relation metadata knows both owned keys, `for("orderVersion")` copies the full composite key from the created parent row.

## Reuse An Existing Composite Parent

```ts
const version = await factories.orderVersions.create({
  orderId: 100,
  version: 3,
});

await factories.orderVersionLines.for("orderVersion", existing(orderVersions, version)).create({
  sku: "SKU-2",
});
```

This is usually the clearest option when your test already has one meaningful parent row.

## Parent Side

```ts
const graph = await factories.orderVersions.hasMany("lines", 2).createGraph({
  orderId: 100,
  version: 3,
});
```

Parent-side planning also works because the relation owns the full set of keys.

## When To Avoid Table-Only Fallback

```ts
const factories = createFactories({
  db,
  tables: { orderVersions, orderVersionLines },
});

await factories.orderVersionLines.create();
```

This style is intentionally too weak for composite foreign keys. Use relation-aware runtimes or explicit overrides instead.
