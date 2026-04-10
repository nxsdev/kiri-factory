# kiri-factory

Schema-driven factories for Drizzle ORM.

`kiri-factory` is built for real database tests and relation-heavy schemas. It is meant for the point where plain `db.insert(...)` calls and ad-hoc helpers stop scaling well.

- infers common required values from your schema
- supports reusable factory definitions with traits and transient inputs
- plans relation graphs for both stable `relations(...)` and RQB v2 `defineRelations(...)`
- stays compatible with real database test flows instead of pushing you toward mocks

For bulk fake data, `drizzle-seed` is still the better tool.  
For precise test setup, reusable scenarios, and relation-aware records, `kiri-factory` is the better fit.

## Install

```bash
pnpm add drizzle-orm kiri-factory
```

Requirements:

- ESM only
- Node `^20.19.0 || >=22.12.0`
- `kiri-factory` and `kiri-factory/rqb-v1` are tested with `drizzle-orm` `0.45.x`
- `kiri-factory/rqb-v2` is tested with `drizzle-orm` `1.0.0-beta.21`

## Choose Your Entrypoint

| Import                | Use when                                                        | Relation model  |
| --------------------- | --------------------------------------------------------------- | --------------- |
| `kiri-factory`        | default path for table-only runtimes or stable `relations(...)` | stable / RQB v1 |
| `kiri-factory/rqb-v1` | you want to pin the stable path explicitly                      | stable / RQB v1 |
| `kiri-factory/rqb-v2` | your project uses `defineRelations(...)`                        | RQB v2          |

## Quick Start

### Table-only runtime

```ts
import { createFactories } from "kiri-factory";
import { users, posts } from "./db/schema";

const factories = createFactories({
  db,
  tables: { users, posts },
});

const user = await factories.users.create();
const post = await factories.posts.create();
```

### Stable relations

```ts
import * as schema from "./db/schema";
import { createFactories } from "kiri-factory";

const factories = createFactories({
  db,
  schema,
});

await factories.posts.for("author").create();
await factories.users.hasMany("posts", 2).createGraph();
```

### RQB v2

```ts
import { defineRelations } from "drizzle-orm";
import { createFactories } from "kiri-factory/rqb-v2";
import * as schema from "./db/schema";

const relations = defineRelations(schema, (r) => ({
  users: {
    groups: r.many.groups({
      from: r.users.id.through(r.usersToGroups.userId),
      to: r.groups.id.through(r.usersToGroups.groupId),
    }),
  },
  groups: {
    participants: r.many.users(),
  },
}));

const factories = createFactories({
  db,
  relations,
});

await factories.users.hasMany("groups", 2).create();
```

## Docs

The docs are split into small Markdown files on purpose so humans, Codex, and Claude Code can jump directly to one topic at a time.

- [Docs index](./docs/README.md)
- [Getting started](./docs/getting-started.md)
- [Defining factories](./docs/define-factory.md)
- [Relations and graph returns](./docs/relations.md)
- [Many-to-many patterns](./docs/many-to-many.md)
- [Inference and `CHECK` support](./docs/inference.md)
- [Adapters, dialects, and runtime behavior](./docs/adapters.md)
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

`pnpm setup:hooks` installs the repo-local Vite+ Git hooks and points `core.hooksPath` at `.vite-hooks/_`.
The pre-commit hook runs `vp staged`, which in turn applies `vp check --fix` to staged files.
