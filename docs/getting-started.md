# Getting Started

See also:

- [Docs index](./README.md)
- [Defining factories](./define-factory.md)
- [Relations](./relations.md)
- [Many-to-many patterns](./many-to-many.md)

## Which Entrypoint Should I Use?

| Import                | Use when                               |
| --------------------- | -------------------------------------- |
| `kiri-factory`        | you use stable `relations(...)`        |
| `kiri-factory/rqb-v2` | you already use `defineRelations(...)` |

`kiri-factory/rqb-v1` remains available as a compatibility alias for the stable path.

## Install

```bash
pnpm add drizzle-orm kiri-factory
```

Requirements:

- ESM only
- Node `^20.19.0 || >=22.12.0`
- `kiri-factory` is tested with `drizzle-orm` `0.45.x`
- `kiri-factory/rqb-v2` is tested with `drizzle-orm` `1.0.0-beta.21`

## Stable `relations(...)`

Use this when your schema exports stable `relations(...)` objects.

```ts
import * as schema from "./db/schema";
import { createFactories } from "kiri-factory";

const factories = createFactories({
  db,
  schema,
});

const user = await factories.users.create({
  email: "ada@example.com",
});

const profile = await factories.profiles.for("user", user).create();
const posts = await factories.posts.for("author", user).createMany(2);
```

The mental model stays small:

- `build()` / `buildMany()` for in-memory rows
- `create()` / `createMany()` for persisted rows
- `for(...)` for parent wiring

If your schema object includes tables but no relation exports yet, `create()` still works for rows whose required fields can be satisfied directly.  
`for(...)` only becomes available when the schema also exports relation metadata. Without relations metadata, pass foreign keys directly in the child row overrides.

## RQB v2

Use the `rqb-v2` subpath when your project uses `defineRelations(...)`.

```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { defineRelations } from "drizzle-orm";
import { createFactories } from "kiri-factory/rqb-v2";
import * as schema from "./db/schema";

const client = new PGlite();
const db = drizzle({ client });

const relations = defineRelations(schema, (r) => ({
  posts: {
    author: r.one.users({
      from: r.posts.authorId,
      to: r.users.id,
    }),
  },
  users: {
    posts: r.many.posts(),
  },
}));

const factories = createFactories({
  db,
  relations,
});

const author = await factories.users.create();
const post = await factories.posts.for("author", author).create();
```

## Factory vs Seed

Use `kiri-factory` when a test wants explicit rows:

- create one row at a time
- reuse a known parent row with `for(...)`
- keep return values predictable

Use `drizzle-seed` when you want bulk fake data:

- `count`
- `with`
- weighted random
- seeded datasets shared across environments

Official references:

- [Drizzle `drizzle-seed` overview](https://orm.drizzle.team/docs/seed-overview)
- [Drizzle generator functions](https://orm.drizzle.team/docs/seed-functions)

If your next step is customizing one table, continue with [Defining factories](./define-factory.md).  
If your next step is relation wiring patterns, continue with [Relations](./relations.md).
