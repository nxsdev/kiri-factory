# kiri-factory

Schema-driven factories for explicit Drizzle ORM test setup.

`kiri-factory` keeps row creation close to plain `insert`, but removes the noisy parts:

- shared required-column values live in one factory definition
- `for("relation", row)` wires foreign keys by relation name
- `create()` still returns the row for the table you asked for

## Quick Example

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

For shared column definitions, `defineFactory(..., { columns })` reuses the same public
`drizzle-seed` generators used by official `seed(...).refine((f) => ...)` examples:

```ts
const customerFactory = defineFactory(customers, {
  columns: (f) => ({
    status: "active",
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

Bulk seeding still belongs to `drizzle-seed`.  
`kiri-factory` stays focused on readable row creation and relation wiring for tests.

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

## Entrypoints

| Import                | Use when                                  |
| --------------------- | ----------------------------------------- |
| `kiri-factory`        | your project uses stable `relations(...)` |
| `kiri-factory/rqb-v2` | your project uses `defineRelations(...)`  |

## What It Does

- `build()` / `buildMany()` for in-memory rows
- `create()` / `createMany()` for persisted rows
- `for("relation", row)` for explicit parent wiring
- `defineFactory(..., { columns })` for reusable per-table definitions

`kiri-factory` is intentionally narrow. It does not try to replace `drizzle-seed`,
prove every database constraint ahead of time, or hide multi-row scenarios behind a
second DSL.

### RQB v2 `defineRelations(...)`

```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createFactories } from "kiri-factory/rqb-v2";
import { defineRelations } from "drizzle-orm";
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

If you want the official seeding API itself, go straight to:

- [Drizzle `drizzle-seed` overview](https://orm.drizzle.team/docs/seed-overview)
- [Drizzle generator functions](https://orm.drizzle.team/docs/seed-functions)
- [Drizzle `with` seeding guide](https://orm.drizzle.team/docs/guides/seeding-using-with-option)

## Docs

The docs are split into small Markdown files so humans and agents can jump directly to one topic.

- [Docs index](./docs/README.md)
- [Getting started](./docs/getting-started.md)
- [Defining factories](./docs/define-factory.md)
- [Relations](./docs/relations.md)
- [Inference and `CHECK` guardrails](./docs/inference.md)
- [Adapters and transactions](./docs/adapters.md)
- [Compatibility and limits](./docs/compatibility.md)

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
