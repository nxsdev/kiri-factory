# Inference and `CHECK` Support

See also:

- [Docs index](./README.md)
- [Defining factories](./define-factory.md)
- [Compatibility and limits](./compatibility.md)
- [Adapters and transactions](./adapters.md)

`kiri-factory` reads common Drizzle metadata and uses it to build rows automatically.

For plain auto-generated columns, the runtime stays close to Drizzle's official
`drizzle-seed` selector logic. The runtime does not embed the full seeding engine,
but it does reuse the same public generator surface and align its built-in column
selection with official `drizzle-seed` where possible.

That distinction matters:

- a generator existing in `drizzle-seed` does **not** automatically mean kiri-factory will pick it during plain auto inference
- kiri-factory only auto-selects generators that the official selector logic already chooses for that dialect and that still fit the factory's fail-fast safety rules

## What It Infers

- enums
- Drizzle-supported PostgreSQL / MySQL / SQLite column selectors that `drizzle-seed` also understands
- nullability
- DB defaults and generated columns by omission
- common scalar types that the official selector supports
- dialect-specific types that the official selector supports, such as Postgres `uuid` and `point`
- single-column unique fields when you provide shared `columns(f)` generators

## What It Does Not Auto-Infer

To keep test failures meaningful, kiri-factory does not auto-pick values for:

- unresolved required foreign keys
- `customType(...)` columns without explicit resolvers
- compound, partial, and expression-based unique scenarios that cannot be proven safe
- compound foreign-key scenarios that cannot be proven safe
- generator families that exist in `drizzle-seed` but are not part of the official auto selector for that dialect

Provide those through `columns(f)`, relation wiring with `for(...)`, or call-time overrides.

## Official Generators vs Auto Selector

`drizzle-seed` exposes more generators than its auto selector will choose by default.

That means these are different questions:

- "Can I use this generator explicitly in `columns(f)`?"
- "Will kiri-factory auto-pick this generator from schema metadata alone?"

Example:

- `f.geometry(...)` exists in official `drizzle-seed`
- but plain auto inference in kiri-factory does **not** treat every `geometry(...)` column as safe to auto-generate

Why:

- official docs already call out known `geometry(point)` seeding limitations for `arraySize > 1` and some `srid` combinations
- auto-selecting those columns would turn plain `create()` into a black box that can fail for schema-specific reasons
- keeping them explicit makes failures more predictable

So the rule is:

- if official selector logic already auto-picks the type, kiri-factory can usually auto-pick it too
- if official docs expose the generator but not as a safe generic selector path, use `columns(f)` or explicit overrides instead

That explicit path is first-class:

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

For single-column unique fields, kiri-factory prefers strict behavior over best-effort behavior.

- if a shared `columns(f)` generator can be made unique safely, kiri-factory uses it
- if a unique field does not have a provably unique-safe generator, kiri-factory throws before insert
- compound, partial, and expression-based unique constraints still need explicit modeling with overrides, `columns(f)`, or relation wiring

`verifyCreates()` is the right backstop when:

- you intentionally use fixed explicit values for unique columns
- your schema has non-trivial unique indexes
- you want disposable-DB confirmation that two real inserts still work

## Simple `CHECK` Guardrails

This is best effort and intentionally narrow.

Supported examples:

- `age > 21`
- `score >= 1 AND score <= 5`
- `score BETWEEN 1 AND 5`
- `status IN ('draft', 'published')`

`kiri-factory` no longer invents new values from these expressions.

Instead, it uses them as guardrails:

- if an official auto-generated value violates a simple parsed `CHECK`, the factory fails fast
- if you provide an explicit value that satisfies the `CHECK`, the factory proceeds

If your constraint logic is more complex, use explicit factory logic instead.

```ts
const review = await factories.reviews.create({
  score: 5,
});
```

What this does not try to parse:

- multi-column `CHECK`
- complex SQL expressions or DB functions
- business logic that only makes sense at the application level

Complex `CHECK` expressions are not parsed. When they matter, failures usually surface as database constraint errors during insert, not as kiri-factory inference errors.

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

- if official `drizzle-seed` selector logic supports the type for that dialect, kiri-factory can auto-generate it
- if official selector logic does not support the type, kiri-factory does not add a bespoke built-in fallback
- driver-specific or custom mapped types such as a MySQL `point` represented through `customType(...)` should use a `customTypes` resolver
- types with known seeding edge cases, such as `geometry(point)` configurations called out in the official docs, should stay explicit through `columns(f)` or overrides

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

- if official `drizzle-seed` knows how to generate the column and kiri-factory can prove the result is safe enough, kiri-factory should infer it
- if your schema encodes business rules in arbitrary SQL or driver-specific mapping, use explicit factory logic

If your main concern is composite foreign keys or other support boundaries, continue with [Compatibility and limits](./compatibility.md).  
If you want concrete setup patterns, continue with [Composite foreign keys](./recipes/composite-foreign-keys.md) or the rest of the [Recipes](./recipes/README.md).
