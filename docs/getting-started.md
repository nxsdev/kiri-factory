# Getting Started

See also:

- [Docs index](./README.md)
- [Defining factories](./define-factory.md)
- [Relations and graph returns](./relations.md)
- [Many-to-many patterns](./many-to-many.md)

## Which Entrypoint Should I Use?

| Import                | Use when                                                        | Relation model  |
| --------------------- | --------------------------------------------------------------- | --------------- |
| `kiri-factory`        | default path for table-only runtimes or stable `relations(...)` | stable / RQB v1 |
| `kiri-factory/rqb-v1` | you want to pin the stable path explicitly                      | stable / RQB v1 |
| `kiri-factory/rqb-v2` | you already use `defineRelations(...)`                          | RQB v2          |

If your project already does `import * as schema from "./schema"` and exports stable `relations(...)`, the default entrypoint is usually the right place to start.

## Install

```bash
pnpm add drizzle-orm kiri-factory
```

Requirements:

- ESM only
- Node `^20.19.0 || >=22.12.0`
- `kiri-factory` and `kiri-factory/rqb-v1` are tested with `drizzle-orm` `0.45.x`
- `kiri-factory/rqb-v2` is tested with `drizzle-orm` `1.0.0-beta.21`

## Table-Only Runtime

Use this when you want schema-driven rows plus simple foreign-key fallback.

```ts
import { createFactories } from "kiri-factory";
import { users, posts } from "./db/schema";

const factories = createFactories({
  db,
  tables: { users, posts },
});

const user = await factories.users.create();
const post = await factories.posts.create();
const posts = await factories.posts.createList(3);
```

## Stable Drizzle Relations

Use this when your schema exports stable `relations(...)` objects.

```ts
import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { createFactories } from "kiri-factory";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));

const factories = createFactories({
  db,
  schema: { users, posts, usersRelations, postsRelations },
});

await factories.posts.for("author").create({
  title: "Hello",
});

await factories.users.hasMany("posts", 2).createGraph({
  name: "Ada",
});
```

## RQB v2

Use the `rqb-v2` subpath when your project uses `defineRelations(...)`.

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
await factories.groups.hasMany("participants", 2).createGraph();
```

If your next question is about direct many-to-many behavior, continue with [Many-to-many patterns](./many-to-many.md).

## `tables` vs `schema`

`tables` is the canonical input:

```ts
const factories = createFactories({
  db,
  tables: { users, posts, sessions },
});
```

`schema` is a convenience alias when you already export something like `import * as schema from "./schema"`:

```ts
const factories = createFactories({
  db,
  schema,
});
```

When `schema` is used, non-table exports such as enums are ignored automatically.

If your next step is to customize one table, continue with [Defining factories](./define-factory.md).  
If your next step is relation planning, continue with [Relations and graph returns](./relations.md).
