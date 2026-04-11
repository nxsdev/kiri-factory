# Custom Types

Use inference resolvers when a required `customType(...)` column cannot be generated safely
from built-in heuristics.

## Runtime-Level Resolver

```ts
const factories = createFactories({
  db,
  schema: { jsonNotes },
  inference: {
    customTypes: {
      text: ({ sequence }) => ({ value: sequence }),
    },
  },
});
```

That example is SQLite-specific and uses a JSON payload stored in text.

## Exact SQL Type Or Normalized Type

You can also target dialect-specific custom types:

```ts
const factories = createFactories({
  db,
  schema: { vectorNotes },
  inference: {
    customTypes: {
      "vector(3)": () => "[0,0,0]",
      vector: () => "[0,0,0]",
    },
  },
});
```

Use the most specific key that helps:

- exact SQL type first
- normalized SQL type second
- Drizzle column type last

## Definition-Level Resolver

If the rule belongs to one table only, keep it next to the table definition:

```ts
const noteFactory = defineFactory(vectorNotes, {
  inference: {
    customTypes: {
      vector: () => "[0,0,0]",
    },
  },
});
```

## Source Shape

See:

- `test/factory.test.ts` for `vectorNotes` and `pointValue`
- `test/sqlite.test.ts` for `jsonNotes`

## Continue With

- [Inference](../inference.md)
- [API reference](../api.md)
