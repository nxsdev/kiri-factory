[![npm version](https://img.shields.io/npm/v/kiri-factory)](https://www.npmjs.com/package/kiri-factory)
[![CI](https://github.com/nxsdev/kiri-factory/actions/workflows/ci.yml/badge.svg)](https://github.com/nxsdev/kiri-factory/actions/workflows/ci.yml)
![License](https://img.shields.io/npm/l/kiri-factory)
![Types](https://img.shields.io/npm/types/kiri-factory)
![Node](https://img.shields.io/node/v/kiri-factory)

# kiri-factory

Schema-first test factories for Drizzle ORM.

> [!IMPORTANT]
> `kiri-factory` is still early.
> npm publishing is still being finalized, and breaking changes are still possible.
> Production use is not recommended yet.
> For now, prefer evaluation in tests, local tooling, or internal development workflows.

`kiri-factory` gives you test-friendly factories directly from your Drizzle schema.

It supports both:

- stable Drizzle `relations(...)`
- Drizzle's current beta `Relational Queries v2` shape through `defineRelations(...)` and the `kiri-factory/rqb-v2` entrypoint

You can start with zero per-table factory definitions.
Required columns are inferred from the schema using the same generator selection logic that powers `drizzle-seed`, missing single-column parents can be auto-created during `create()`, and `create()` still gives you the inserted row back.

When you do want shared defaults, `defineFactory(..., { columns })` uses the same public `drizzle-seed` generator surface as the official seeding API.
That means the same `columns(f)` definition can power both small test setup and bulk seeding.

In short:

- start from your schema
- use `create()` / `createMany()` for test rows
- add `defineFactory(...)` only where shared defaults help
- reuse the same `columns(f)` in `drizzle-seed`

## Quick Example

```ts
import * as schema from "./db/schema";
import { createFactories } from "kiri-factory";

const factories = createFactories({
  db,
  schema,
  seed: 42,
});

const session = await factories.sessions.create();
// a required single-column parent can be auto-created when its table is in the runtime
```

If one table needs shared values, add a factory definition:

```ts
const customerFactory = defineFactory(customers, {
  columns: (f) => ({
    status: "active",
    companyName: f.companyName(),
    contactName: f.fullName(),
    contactEmail: f.email(),
  }),
});

const factories = createFactories({
  db,
  schema,
  seed: 42,
  definitions: {
    customers: customerFactory,
  },
});
```

And the same definition plugs straight into `drizzle-seed`:

```ts
await seed(db, schema).refine((f) => ({
  customers: {
    count: 1000,
    columns: customerFactory.columns(f),
  },
}));
```

`seed` is optional. The default is `0`, which preserves the built-in stable per-column
determinism. `kiri-factory` does not log the seed automatically, but you can read it back
from the runtime with `factories.getSeed()`.

What `seed` is good for:

- reproducible test data across runs
- easier debugging when a generated row causes a failure
- intentionally varying generated data in CI when you want broader coverage

This follows the same general idea as Drizzle's own deterministic seed docs:

- [Drizzle seed overview](https://orm.drizzle.team/docs/seed-overview)
- [What is deterministic data generation?](https://orm.drizzle.team/docs/seed-overview#what-is-deterministic-data-generation)

If you want opt-in variation between runs, a common pattern is:

```ts
const factories = createFactories({
  db,
  schema,
  seed: Number(process.env.TEST_SEED ?? 0),
});
```

The generated values still depend on factory call order and sequence state, so the most
reliable reproduction recipe is: same schema, same seed, same sequence reset, same call
order.

## Install

```bash
pnpm add drizzle-orm kiri-factory
```

Requirements:

- ESM only
- Node `^20.19.0 || >=22.12.0`
- `kiri-factory` is tested with `drizzle-orm` `0.45.x`
- `kiri-factory/rqb-v2` is tested with Drizzle's current beta `Relational Queries v2` path on `drizzle-orm` `1.0.0-beta.21`

`kiri-factory/rqb-v1` is kept as a compatibility alias for the stable path.

## Entrypoints

| Import                | Use when                                                              |
| --------------------- | --------------------------------------------------------------------- |
| `kiri-factory`        | your project uses stable `relations(...)`                             |
| `kiri-factory/rqb-v2` | your project uses beta `defineRelations(...)` / Relational Queries v2 |

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
- [API reference](./docs/api.md)
- [Versioning and entrypoints](./docs/versioning.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [FAQ](./docs/faq.md)
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
