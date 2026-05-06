[![npm version](https://img.shields.io/npm/v/kiri-factory)](https://www.npmjs.com/package/kiri-factory)
[![CI](https://github.com/nxsdev/kiri-factory/actions/workflows/ci.yml/badge.svg)](https://github.com/nxsdev/kiri-factory/actions/workflows/ci.yml)
![License](https://img.shields.io/npm/l/kiri-factory)
![Types](https://img.shields.io/npm/types/kiri-factory)
![Node](https://img.shields.io/node/v/kiri-factory)

# kiri-factory

Schema-first test factories for Drizzle ORM.

`kiri-factory` creates small, typed test factories from your Drizzle schema. You
can start with no per-table factory files, then add `defineFactory(...)` only
where shared defaults or named variants help.

> [!IMPORTANT]
> `kiri-factory` is still early. Pin exact versions in production test suites
> and check the changelog before upgrading across `0.x` releases.

## Install

```bash
pnpm add drizzle-orm kiri-factory
```

Requirements:

- ESM only
- Node `^20.19.0 || >=22.12.0`
- peer `drizzle-orm` range: `>=0.36.4 <1 || >=1.0.0-beta.1 <2`

## Basic Usage

```ts
import * as schema from "./db/schema";
import { createFactories } from "kiri-factory";

const factories = createFactories({
  db,
  schema,
});

const user = await factories.users.create({
  email: "alice@example.com",
});

const post = await factories.posts.create({
  authorId: user.id,
  title: "Hello",
});
```

Factories support:

- `build()` / `buildMany()` for in-memory rows
- `create()` / `createMany()` for persisted rows
- call-site overrides for one-off values and explicit foreign keys
- auto-created missing single-column parents during `create()` / `createMany()`

## Shared Defaults

Use `defineFactory(...)` when one table needs reusable defaults. The `columns`
callback receives the same public generator surface used by `drizzle-seed`.

```ts
import { createFactories, defineFactory } from "kiri-factory";

const userFactory = defineFactory(users, {
  columns: (f) => ({
    role: "member",
    email: f.email(),
    nickname: f.string({ isUnique: true }),
  }),
});

const factories = createFactories({
  db,
  schema,
  definitions: {
    users: userFactory,
  },
});

await factories.users.create();
```

You can also reuse the same definition from `drizzle-seed`:

```ts
await seed(db, schema).refine((f) => ({
  users: {
    count: 1000,
    columns: userFactory.columns(f),
  },
}));
```

## Traits

Traits are named variants on a factory. They are exposed as properties under
`factory.traits`.

```ts
const userFactory = defineFactory(users, {
  columns: {
    role: "member",
  },
  traits: {
    admin: {
      role: "admin",
    },
  },
});

const admin = await factories.users.traits.admin.create({
  email: "admin@example.com",
});
```

Trait values are applied after `columns` and before call-site overrides. You can
still override a trait at the call site when a test needs a one-off value.

## Relations

For a specific existing parent, pass the foreign-key columns directly:

```ts
const user = await factories.users.create();

await factories.sessions.create({
  userId: user.id,
});
```

If a required single-column parent key is missing and the parent table is part of
the runtime, `create()` can create the parent first:

```ts
const session = await factories.sessions.create();
// creates one user first, then the session
```

Composite foreign keys are explicit-only:

```ts
const version = await factories.orderVersions.create({
  orderId: 100,
  version: 1,
});

await factories.orderVersionLines.create({
  orderId: version.orderId,
  version: version.version,
  sku: "SKU-1",
});
```

## RQB v2

Use `kiri-factory/rqb-v2` when your project uses Drizzle's beta
`defineRelations(...)` / Relational Queries v2 shape.

```ts
import { defineRelations } from "drizzle-orm";
import { createFactories } from "kiri-factory/rqb-v2";
import * as schema from "./db/schema";

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
```

`kiri-factory/rqb-v1` is a compatibility alias for the stable entrypoint.

## API Summary

```ts
defineFactory(table, {
  columns?: FactorySeedColumnsInput<typeof table>,
  traits?: Record<string, FactorySeedColumnsInput<typeof table>>,
  inference?: FactoryInferenceOptions<typeof table>,
});

createFactories({
  db,
  schema, // stable entrypoint
  definitions,
  adapter,
  inference,
  seed,
});

createFactories({
  db,
  relations, // rqb-v2 entrypoint
  definitions,
  adapter,
  inference,
  seed,
});
```

The returned registry exposes one property per table plus:

- `get(keyOrTable)`
- `getSeed()`
- `resetSequences(next?)`
- `lint()`
- `verifyCreates()`

## More Detail

Most users should be able to start from this README. The detailed docs are kept
for deeper reference:

- [Defining factories](./docs/define-factory.md)
- [Relations](./docs/relations.md)
- [Inference and `CHECK` guardrails](./docs/inference.md)
- [Adapters and transactions](./docs/adapters.md)
- [API reference](./docs/api.md)

Official Drizzle seed docs:

- [Seed overview](https://orm.drizzle.team/docs/seed-overview)
- [Generator functions](https://orm.drizzle.team/docs/seed-functions)

## Development

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

Before publishing, run:

```bash
pnpm prepublishOnly
pnpm publish --access public
```
