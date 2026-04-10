# Inference and `CHECK` Support

See also:

- [Docs index](./README.md)
- [Defining factories](./define-factory.md)
- [Compatibility and limits](./compatibility.md)
- [Adapters, dialects, and runtime behavior](./adapters.md)

`kiri-factory` reads common Drizzle metadata and uses it to build rows automatically.

## What It Infers

- enums
- `varchar(length)` and text length metadata
- nullability
- DB defaults and generated columns by omission
- common scalar types like string, number, bigint, boolean, date, json, and arrays
- simple foreign-key parents as a fallback in table-only runtimes
- simple single-column `CHECK` constraints

## Simple `CHECK` Support

This is best effort and intentionally narrow.

Supported examples:

- `age > 21`
- `score >= 1 AND score <= 5`
- `score BETWEEN 1 AND 5`
- `status IN ('draft', 'published')`

If your constraint logic is more complex, use explicit factory logic instead.

```ts
const reviewFactory = defineFactory(reviews, {
  state: {
    score: 5,
  },
});
```

You can disable `CHECK` parsing for one definition or one runtime:

```ts
const reviewFactory = defineFactory(reviews, {
  inference: {
    checks: false,
  },
});
```

## `customType(...)`

When schema metadata is not enough, add an inference resolver.

```ts
const factories = createFactories({
  db,
  schema,
  inference: {
    customTypes: {
      vector: ({ sequence }) => [sequence, sequence + 1, sequence + 2],
    },
  },
});
```

Resolver lookup order:

1. `columns["table.column"]`
2. `columns["column"]`
3. `customTypes["exact sql type"]`
4. `customTypes["normalized sql type"]`
5. `customTypes["Drizzle columnType"]`

Local definition-level inference overrides runtime-level inference.

```ts
const embeddingFactory = defineFactory(embeddings, {
  inference: {
    columns: {
      "embeddings.embedding": ({ sequence }) => [sequence * 10],
    },
  },
});
```

## Rule of Thumb

- if Drizzle exposes clear metadata, `kiri-factory` should infer it
- if your schema encodes business rules in arbitrary SQL or driver-specific mapping, use explicit factory logic

If you need to turn inferred rows into persisted rows on non-standard drivers, continue with [Adapters, dialects, and runtime behavior](./adapters.md).  
If you want the exact support boundaries, continue with [Compatibility and limits](./compatibility.md).
