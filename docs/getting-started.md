# Getting Started

See also:

- [Docs index](./README.md)
- [Defining factories](./define-factory.md)
- [Relations](./relations.md)
- [Compatibility and limits](./compatibility.md)

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
- peer install range: `drizzle-orm` `>=0.36.4 <1 || >=1.0.0-beta.1 <2`
- `kiri-factory` is tested with `drizzle-orm` `0.45.x`
- `kiri-factory/rqb-v2` is tested with Drizzle's current beta `Relational Queries v2` path on `drizzle-orm` `1.0.0-beta.21`

The peer range is intentionally broader than the repository test matrix so Drizzle users do not
get blocked on install while the beta line keeps moving. The versions above are the ones
currently exercised in this repository.

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
  email: "alice@example.com",
});

const account = await factories.accounts.create({
  userId: user.id,
  providerId: "github",
  accountId: "github-user-123",
});

const session = await factories.sessions.create({
  userId: user.id,
});
```

The mental model stays small:

- `build()` / `buildMany()` for in-memory rows
- `create()` / `createMany()` for persisted rows
- call-site overrides for explicit parent wiring
- missing single-column parents can be auto-created during `create()` / `createMany()`

If your schema object exports tables but no `relations(...)` yet, `create()` and `createMany()` still work for any row whose required fields can be satisfied directly or by auto-creating missing single-column parents from other registered tables.

This row-first pattern maps well to common auth schemas:

- `user`
- `account`
- `session`
- `verification`

## RQB v2

Use the `rqb-v2` subpath when your project uses Drizzle's current beta `Relational Queries v2` API through `defineRelations(...)`.

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
const post = await factories.posts.create({
  authorId: author.id,
});
```

## Factory vs Seed

Use `kiri-factory` when a test wants explicit rows:

- create one row at a time
- reuse a known parent row with explicit foreign-key overrides
- keep return values predictable

Use `drizzle-seed` when you want bulk fake data:

- `count`
- `with`
- weighted random
- seeded datasets shared across environments

`kiri-factory` also accepts `seed`, but it uses it for small factory runs rather than for
full bulk seeding:

```ts
const factories = createFactories({
  db,
  schema,
  seed: Number(process.env.TEST_SEED ?? 0),
});
```

This is useful when you want deterministic generated rows by default, but still want the
option to vary them in CI or while chasing edge cases locally.

Official references:

- [Drizzle `drizzle-seed` overview](https://orm.drizzle.team/docs/seed-overview)
- [What is deterministic data generation?](https://orm.drizzle.team/docs/seed-overview#what-is-deterministic-data-generation)
- [Drizzle generator functions](https://orm.drizzle.team/docs/seed-functions)

If your next step is customizing one table, continue with [Defining factories](./define-factory.md).  
If your next step is relation wiring patterns, continue with [Relations](./relations.md).
