# Inference and `CHECK` Guardrails

See also:

- [Docs index](./README.md)
- [Defining factories](./define-factory.md)
- [Compatibility and limits](./compatibility.md)
- [Adapters and transactions](./adapters.md)

## Short Version

- plain auto generation stays close to Drizzle's official `drizzle-seed` selector logic
- if a type is not part of the official auto selector path, kiri-factory does not auto-pick it
- `CHECK` constraints do **not** generate values
- simple single-column `CHECK` expressions are only used as guardrails
- complex constraints still fail at insert time

## What Auto Inference Covers

Auto inference is for the boring, structural cases:

- enums
- nullability
- DB defaults and generated columns by omission
- official PostgreSQL / MySQL / SQLite selector paths that `drizzle-seed` already understands
- supported dialect-specific types such as Postgres `uuid` and `point`

If a value needs business meaning or driver-specific knowledge, make it explicit instead.

## What Stays Explicit

Use `columns(f)`, `for(...)`, overrides, or custom resolvers for:

- unresolved required foreign keys
- `customType(...)` without a resolver
- compound, partial, or expression-based unique constraints
- compound foreign keys
- generator families that exist in `drizzle-seed` but are not part of the official auto selector for that dialect

## Official Generators vs Auto Selector

These are different:

- "official `drizzle-seed` has a generator for this type"
- "kiri-factory will auto-pick it from schema metadata"

Example:

- `f.geometry(...)` exists in official `drizzle-seed`
- plain `create()` still does **not** auto-pick every `geometry(...)` column

Why:

- official docs already call out `geometry(point)` edge cases
- auto-picking those values would make `create()` a black box

If you want a generator explicitly, use it explicitly:

```ts
const vectorFactory = defineFactory(vectorTable, {
  columns: (f) => ({
    vector: f.vector({
      dimensions: 12,
      decimalPlaces: 5,
      minValue: -100,
      maxValue: 100,
    }),
  }),
});
```

Official references:

- [Drizzle seed overview](https://orm.drizzle.team/docs/seed-overview)
- [Drizzle generator functions](https://orm.drizzle.team/docs/seed-functions)

## Unique Columns

For single-column unique fields, kiri-factory stays strict:

- if `columns(f)` can provide a unique-safe generator, it is allowed
- if not, kiri-factory fails before insert

For compound, partial, and expression-based unique constraints, stay explicit.

Use `verifyCreates()` when you want disposable-DB confirmation that real inserts still work.

## `CHECK` Guardrails

`kiri-factory` does **not** generate values from `CHECK` constraints.

It only parses a narrow subset of simple single-column `CHECK` expressions, such as:

- `age > 21`
- `score >= 1 AND score <= 5`
- `score BETWEEN 1 AND 5`
- `status IN ('draft', 'published')`

That parsing is only used to reject bad generated values early.

- if an auto-generated value violates one of these simple checks, the factory fails fast
- if you pass a valid explicit value, the factory proceeds

```ts
const review = await factories.reviews.create({
  score: 5,
});
```

What is not parsed:

- multi-column `CHECK`
- complex SQL expressions or DB functions
- application-specific business rules encoded in SQL

Those still fail at insert time.

You can disable even this simple parsing:

```ts
const reviewFactory = defineFactory(reviews, {
  inference: {
    checks: false,
  },
});
```

## `customType(...)`

When schema metadata is not enough, add a resolver:

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

Rule of thumb:

- if official selector logic supports the type for that dialect, kiri-factory can usually auto-generate it
- if it does not, keep it explicit

If your main concern is support boundaries, continue with [Compatibility and limits](./compatibility.md).  
If your main concern is setup patterns, continue with [Relations](./relations.md) or [Adapters and transactions](./adapters.md).
