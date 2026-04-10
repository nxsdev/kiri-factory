# kiri-factory

Schema-driven factories for Drizzle ORM.

`kiri-factory` is built for real database tests where plain `db.insert(...)` starts to get noisy:

- large tables with many required columns
- repeated setup across hundreds or thousands of tests
- relation-heavy schemas where foreign keys are easy to get wrong

The core idea is simple:

- `build()` returns one in-memory row
- `buildMany()` returns many in-memory rows
- `create()` returns one row
- `createMany()` returns many rows
- `for("relation", row)` wires foreign keys by relation name instead of raw column names
- `defineFactory(..., { columns: (f) => ({ ... }) })` can share the same public `drizzle-seed` generators used by official `refine((f) => ...)` examples

That keeps test setup explicit without turning the library into a second language.

## Install

```bash
pnpm add drizzle-orm kiri-factory
```

Requirements:

- ESM only
- Node `^20.19.0 || >=22.12.0`
- `kiri-factory` is tested with `drizzle-orm` `0.45.x`
- `kiri-factory/rqb-v2` is tested with `drizzle-orm` `1.0.0-beta.21`

`kiri-factory/rqb-v1` is kept as a compatibility alias for the stable path.

## Choose Your Entrypoint

| Import                | Use when                                  |
| --------------------- | ----------------------------------------- |
| `kiri-factory`        | your project uses stable `relations(...)` |
| `kiri-factory/rqb-v2` | your project uses `defineRelations(...)`  |

## Quick Start

### Stable `relations(...)`

```ts
import * as schema from "./db/schema";
import { createFactories } from "kiri-factory";

const factories = createFactories({
  db,
  schema,
});

const author = await factories.users.create({
  email: "author@example.com",
});

const post = await factories.posts.for("author", author).create({
  title: "Hello",
});
```

### RQB v2 `defineRelations(...)`

```ts
import { drizzle } from "drizzle-orm/pglite";
import { createFactories } from "kiri-factory/rqb-v2";
import { defineRelations } from "drizzle-orm";

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

### Many-to-many

Use the junction table explicitly in both stable and RQB v2.

```ts
const user = await factories.users.create();
const group = await factories.groups.create();

const membership = await factories.memberships.for("user", user).for("group", group).create({
  role: "owner",
});
```

## Why This Shape?

The main value is inference plus explicit row creation.

- schema metadata fills common required values for you
- relation names replace fragile FK column wiring
- returned values stay predictable because `create()` always returns the row for that table

For bulk fake data, `drizzle-seed` is still the better tool.  
For precise test setup and reusable factory definitions, `kiri-factory` is the better fit.

You can also share column definitions with official `drizzle-seed`:

```ts
const customerFactory = defineFactory(customers, {
  columns: (f) => ({
    companyName: f.companyName(),
    contactName: f.fullName(),
    contactEmail: f.email(),
  }),
});

await seed(db, schema).refine((f) => ({
  customers: {
    count: 1000,
    columns: customerFactory.columns(f),
  },
}));
```

That reuse is intentionally narrow:

- shared column generators come from the public `drizzle-seed` generator surface
- bulk seeding behavior still belongs to `drizzle-seed`
- runtime validation and safety rules still belong to `kiri-factory`

## Docs

The docs are split into small Markdown files so humans, Codex, and Claude Code can jump directly to one topic.

- [Docs index](./docs/README.md)
- [Getting started](./docs/getting-started.md)
- [Defining factories](./docs/define-factory.md)
- [Relations](./docs/relations.md)
- [Many-to-many patterns](./docs/many-to-many.md)
- [Inference and `CHECK` support](./docs/inference.md)
- [Adapters and transactions](./docs/adapters.md)
- [Compatibility and limits](./docs/compatibility.md)
- [Recipes](./docs/recipes/README.md)

## Development

This repository uses `pnpm` workspaces, catalogs, and `Vite+`.

```bash
pnpm setup:hooks
pnpm check
pnpm test
pnpm build
```

`pnpm setup:hooks` installs the repo-local Vite+ hooks.  
The pre-commit hook runs `vp staged`, which applies `vp check --fix` to staged files.
