# Many-to-Many Patterns

See also:

- [Docs index](./README.md)
- [Getting started](./getting-started.md)
- [Relations and graph returns](./relations.md)
- [Compatibility and limits](./compatibility.md)

`kiri-factory` supports three practical many-to-many styles.

## 1. Stable Drizzle: Explicit Junction Table

This is the clearest default when the through row matters.

```ts
await factories.memberships.for("member").for("group").create();
```

Choose this when:

- the through row has payload columns
- the through row is meaningful in tests
- you want maximum explicitness

## 2. Stable Drizzle: Bridge to a Direct Relation Key

If you want stable tests to read more like RQB v2, add a bridge once.

```ts
import { createFactories, manyToMany } from "kiri-factory";

const factories = createFactories({
  db,
  schema,
  bridges: {
    users: {
      groups: manyToMany({
        through: usersToGroups,
        source: "user",
        target: "group",
      }),
    },
  },
});

await factories.users.hasMany("groups", 2).create();
```

Choose this when:

- your stable Drizzle schema already models many-to-many through a junction table
- you want test call sites to use a direct relation key
- the through row does not need extra required payload values

## 3. RQB v2: Direct Relation Planning

When using `defineRelations(...)`, direct many-to-many planning is built in.

```ts
import { createFactories } from "kiri-factory/rqb-v2";

await factories.users.hasMany("groups", 2).create();
await factories.groups.hasMany("participants", 2).createGraph();
```

Choose this when:

- your project already uses `defineRelations(...)`
- you want direct many-to-many edges without a stable bridge helper

## Which One Should I Prefer?

- through row matters: explicit junction table
- stable Drizzle, but you want direct test call sites: bridge
- RQB v2 project: direct relation planning

If your through table has required payload columns, the explicit junction-table factory is still the clearest option even in RQB v2 projects.

If you need the general return-value and graph rules behind these examples, continue with [Relations and graph returns](./relations.md).  
If you want the current support boundaries, continue with [Compatibility and limits](./compatibility.md).
