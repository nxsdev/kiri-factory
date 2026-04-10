# Inference and `CHECK` Support

See also:

- [Docs index](./README.md)
- [Defining factories](./define-factory.md)
- [Compatibility and limits](./compatibility.md)
- [Adapters and transactions](./adapters.md)

`kiri-factory` reads common Drizzle metadata and uses it to build rows automatically.

## What It Infers

- enums
- `varchar(length)` and text length metadata
- nullability
- DB defaults and generated columns by omission
- common scalar types like string, number, bigint, boolean, date, json, and arrays
- common UUID and spatial defaults such as Postgres `uuid` and `point`
- simple single-column `CHECK` constraints
- single-column unique fields when you provide shared `columns(f)` generators

## What It Does Not Auto-Infer

To keep test failures meaningful, kiri-factory does not auto-pick values for:

- unresolved required foreign keys
- `customType(...)` columns without explicit resolvers
- compound, partial, and expression-based unique scenarios that cannot be proven safe
- compound foreign-key scenarios that cannot be proven safe

Provide those through `columns(f)`, `defaults`, `state(...)`, or call-time overrides.

## Unique Columns

For single-column unique fields, kiri-factory prefers strict behavior over best-effort behavior.

- if a shared `columns(f)` generator can be made unique safely, kiri-factory uses it
- if a unique field does not have a provably unique-safe generator, kiri-factory throws before insert
- compound, partial, and expression-based unique constraints still need explicit modeling with overrides, `state(...)`, or relation wiring

`verifyCreates()` is the right backstop when:

- you intentionally use fixed explicit values for unique columns
- your schema has non-trivial unique indexes
- you want disposable-DB confirmation that two real inserts still work

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

What this does not try to parse:

- multi-column `CHECK`
- complex SQL expressions or DB functions
- business logic that only makes sense at the application level

Complex `CHECK` expressions are not parsed. When they matter, failures usually surface as database constraint errors during insert, not as kiri-factory required-column inference errors.

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

Spatial and driver-specific types follow this rule:

- built-in metadata-rich cases like Postgres `uuid` and `point` get simple default values automatically
- driver-specific or custom mapped types such as a MySQL `point` represented through `customType(...)` should use a `customTypes` resolver

```ts
const factories = createFactories({
  db,
  schema,
  inference: {
    customTypes: {
      point: ({ sequence }) => ({ x: sequence, y: sequence + 1 }),
    },
  },
});
```

## Rule of Thumb

- if Drizzle exposes clear metadata, `kiri-factory` should infer it
- if your schema encodes business rules in arbitrary SQL or driver-specific mapping, use explicit factory logic

If your main concern is composite foreign keys or other support boundaries, continue with [Compatibility and limits](./compatibility.md).  
If you want concrete setup patterns, continue with [Composite foreign keys](./recipes/composite-foreign-keys.md) or the rest of the [Recipes](./recipes/README.md).
