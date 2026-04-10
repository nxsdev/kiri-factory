# kiri-factory

Inferred, schema-driven factories for Drizzle ORM, built for real database tests and complex relation graphs.

`kiri-factory` is aimed at the point where direct `db.insert(...)` calls and ad-hoc test helpers start to break down:

- large tables with many required columns
- relation-heavy schemas
- real database test suites that need readable setup code
- projects that want one factory layer instead of many one-off helpers

It gives you one connected runtime for test data creation and one pure definition layer for shared factory logic.

The main value is inference.

- reads table metadata and fills common required columns automatically
- respects enums, varchar length, nullability, defaults, and generated columns
- can infer simple foreign-key parents without a hand-written factory for every table
- lets you start from `createFactories({ db, schema })` and add explicit definitions only where your domain needs them

That matters most when your schema is large enough that writing raw `insert(...)` values becomes the test itself.

- main entrypoint: `createFactories({ db, tables | schema, definitions? })`
- shared declarations: `defineFactory(table, options?)`
- table-only runtime: `factories.users.create()`
- relation-aware runtime: `factories.posts.for("author").create()`

For bulk fake data across many rows, `drizzle-seed` is still the better fit.  
For focused test records, overrides, reusable setup, and relation-aware graphs, `kiri-factory` is the better fit.

## Install

```bash
pnpm add drizzle-orm kiri-factory
```

Notes:

- ESM-only package
- requires Node `^20.19.0 || >=22.12.0`
- tested against `drizzle-orm` `0.45.x`
- the default `create()` adapter expects Drizzle's `returning()` support

## Two Modes

`kiri-factory` has two runtime modes.

1. Table-only runtime
   You pass `tables` or a table-only `schema` object. You get property access, direct overrides, `createList()`, and simple FK auto-create.
2. Relation-aware runtime
   You pass the same `schema` object you use with Drizzle, including stable `relations(...)` exports. You also get typed `for(...)`, `hasOne(...)`, and `hasMany(...)` chain helpers.

If your project already follows the usual Drizzle pattern of `import * as schema from "./schema"`, you can pass that same object to `createFactories({ db, schema })`.

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

`createFactories(...)` is the main public API.  
You set up the runtime once, then call `create()` directly on each table entry.

### Relation-aware runtime

With stable Drizzle `relations(...)` exports, `kiri-factory` can expose typed relation chain helpers.

```ts
import { relations } from "drizzle-orm";
import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";

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
```

```ts
import * as schema from "./db/schema";

const factories = createFactories({
  db,
  schema,
});

await factories.posts.for("author").create();
await factories.users.hasMany("posts", 2).create();
```

The relation names come from your Drizzle relation keys, such as `"author"` or `"posts"`, not from table names.

## Pure Definitions

Use `defineFactory(...)` when you want shared behavior for a specific table.

```ts
import { defineFactory } from "kiri-factory";

export const userFactory = defineFactory(users, {
  defaults: {
    role: "member",
  },
  state: ({ seq }) => ({
    email: `user-${seq}@example.com`,
    nickname: `user-${seq}`,
  }),
  traits: {
    admin: {
      state: {
        role: "admin",
      },
    },
  },
});

const admin = await userFactory.withTraits("admin").build();
```

Definitions are pure.

- `build()` works without a DB
- `create()` belongs to the connected runtime returned by `createFactories(...)`

## Mixing Auto and Explicit Factories

You do not need to define every table up front.

```ts
const userFactory = defineFactory(users, {
  defaults: {
    role: "admin",
  },
});

const factories = createFactories({
  db,
  tables: { users, posts, sessions },
  definitions: {
    users: userFactory,
  },
});

await factories.users.create();
await factories.posts.create();
```

This gives you:

- auto-generated factories for tables without definitions
- explicit custom logic only where you need it

## Table Input

`tables` is the canonical input:

```ts
const factories = createFactories({
  db,
  tables: { users, posts, sessions },
});
```

`schema` is a convenience alias when you already export an object like `import * as schema from "./schema"`:

```ts
const factories = createFactories({
  db,
  schema,
});
```

When `schema` is used, non-table exports such as enums are ignored automatically.  
Pass either `tables` or `schema`, not both.

## Looking Up Factories

Property access is the common path:

```ts
await factories.users.create();
```

There is also a fallback accessor for awkward names or table-object lookup:

```ts
await factories.get(users).create();
await factories.get("users").create();
```

## createList

Use `createList(count)` when you want several persisted rows:

```ts
await factories.users.createList(3);
await factories.users.createList(3, (index) => ({
  email: `user-${index + 1}@example.com`,
}));
```

The same pattern exists for pure definitions with `buildList(...)`.

## Return Values

`create()` returns the row for the factory you called.

```ts
const post = await factories.posts.for("author").create();
```

In that example, the return value is the created `post` row.  
The related `author` row is created as a side effect, but it is not nested into the return value.

`createList(count)` returns an array of those root rows:

```ts
const posts = await factories.posts.createList(3);
```

If you need to reuse a related row across multiple calls, create it explicitly first and pass it through `existing(...)`:

```ts
import { existing } from "kiri-factory";
import { users } from "./db/schema";

const author = await factories.users.create();

const firstPost = await factories.posts.for("author", existing(users, author)).create();
const secondPost = await factories.posts.for("author", existing(users, author)).create();
```

`createGraph()` returns the root row plus only the relations you planned explicitly with
`for(...)`, `hasOne(...)`, or `hasMany(...)`.

```ts
const graph = await factories.users
  .hasMany("posts", 2, (index) => ({
    title: `Post ${index + 1}`,
  }))
  .createGraph({
    email: "graph@example.com",
    nickname: "graph",
  });

const posts = graph.relations.posts ?? [];

graph.row.id;
graph.source;
posts[0]?.row.title;
```

Implicit FK auto-create fallback still runs when needed, but it does not appear in the graph result.
Graph nodes can represent either newly created rows or reused rows from `existing(table, row)`.

## Traits, Overrides, and Transient Inputs

Traits are declared once and applied where needed:

```ts
const userFactory = defineFactory(users, {
  traits: {
    admin: {
      state: {
        role: "admin",
      },
    },
  },
});

const row = await userFactory.withTraits("admin").build();
```

Direct column overrides always work:

```ts
await factories.users.create({
  email: "ada@example.com",
  nickname: "ada",
});
```

Transient inputs are available inside `state(...)`, but are never persisted:

```ts
const userFactory = defineFactory(users, {
  transient: {
    domain: "example.com",
  },
  state: ({ seq, transient }) => ({
    email: `user-${seq}@${transient.domain}`,
    nickname: `user-${seq}`,
  }),
});

const row = await userFactory.build(
  {},
  {
    transient: {
      domain: "kiri.dev",
    },
  },
);
```

## Relation Planning

`kiri-factory` supports two relation strategies.

### 1. FK auto-create fallback

This works in table-only mode and does not require Drizzle relation exports.

```ts
const factories = createFactories({
  db,
  tables: { users, posts },
});

const post = await factories.posts.create();
```

In that case, the runtime creates a `users` row first and fills `posts.userId`.

Current scope is intentionally narrow:

- only in `create()`
- only for foreign keys that can be read safely from the table metadata
- intended as a fallback, not the main graph API

### 2. Relation-aware chain helpers

This mode requires `schema` plus stable `relations(...)` exports.

```ts
const factories = createFactories({
  db,
  schema,
});

await factories.posts.for("author").create();
await factories.users.hasMany("posts", 2).create();
```

`for(...)` is for belongs-to relations on the child side.  
`hasOne(...)` is for inverse one-to-one relations on the parent side.  
`hasMany(...)` is for to-many relations on the parent side.

Stable Drizzle types let `for(...)` and `hasOne(...)` narrow to `one` relations at the type level.  
The final ownership check still happens at runtime, because stable Drizzle types do not fully encode which side owns the foreign key.

### Relation Type Support

`kiri-factory` treats relation planning as "which side owns the foreign key?".

#### 1:1

Supported when the relationship can be expressed as one row pointing at one other row.

- child side: use `for(...)` when this table owns the foreign key
- parent side: use `hasOne(...)` when the related row points back to this table
- self relations work when the chain can terminate, usually because the root foreign key is nullable or fully overridden

```ts
await factories.profiles.for("user").create();
await factories.users.hasOne("profile").create();
await factories.employees.for("manager").create();
```

#### 1:many

Supported on both sides.

- child side: use `for(...)` to create one parent and attach this row to it
- parent side: use `hasMany(...)` to create one parent and multiple children

```ts
await factories.posts.for("author").create();
await factories.users.hasMany("posts", 2).create();
```

#### many-to-many

Supported through the junction table, which matches how stable Drizzle models many-to-many relations.

```ts
await factories.memberships.for("member").for("group").create();
```

What is not in `v0.1` yet is a direct shortcut such as `users.attach("groups")`.

#### Multiple Relations To The Same Table

Supported, and the key rule is: always use the Drizzle relation key.

When stable Drizzle needs to disambiguate two relations between the same tables, it uses
`relationName` inside `relations(...)`. The factory API still uses the public relation keys.

```ts
export const commentsRelations = relations(comments, ({ one }) => ({
  author: one(users, {
    relationName: "comment_author",
    fields: [comments.authorId],
    references: [users.id],
  }),
  reviewer: one(users, {
    relationName: "comment_reviewer",
    fields: [comments.reviewerId],
    references: [users.id],
  }),
}));
```

Then the factory calls are:

```ts
await factories.comments.for("author").create();
await factories.comments.for("reviewer").create();
```

Example: explicit parent definition plus child creation.

```ts
const userFactory = defineFactory(users, {
  state: ({ seq }) => ({
    email: `author-${seq}@example.com`,
    nickname: `author-${seq}`,
  }),
});

const factories = createFactories({
  db,
  schema,
  definitions: {
    users: userFactory,
  },
});

await factories.posts.for("author", { role: "admin" }).create();
```

Example: create a parent and two related children.

```ts
await factories.users
  .hasMany("posts", 2, (index) => ({
    title: `Post ${index + 1}`,
  }))
  .create();
```

Example: reuse one existing parent row.

```ts
const author = await factories.users.create();

await factories.posts.for("author", existing(users, author)).create();
```

Example: nest relation planning by passing a prepared related factory.

```ts
const authorFactory = factories.users.hasMany("sessions", 2, {
  expiresAt: new Date("2026-01-01T00:00:00.000Z"),
});

await factories.posts.for("author", authorFactory).create();
```

Precedence is:

1. `for(...)`, `hasOne(...)`, or `hasMany(...)` relation plans
2. direct call-site overrides that do not conflict with planned relation-owned keys
3. FK auto-create fallback for anything still missing

Polymorphic relations and direct many-to-many shortcut builders are intentionally out of scope in `v0.1`.

## Graph Behavior

`createGraph()` and `createGraphList()` return only explicitly planned relation branches.

- `for(...)` and `hasOne(...)` produce one nested node
- `hasMany(...)` produces an array, including `[]` when the planned count is `0`
- `existing(table, row)` appears in the graph with `source: "existing"`
- implicit FK fallback does not appear in the graph result

Graph creation is not wrapped in a transaction by default. If a nested create fails midway, earlier rows may already be persisted.

## Auto-Generation Rules

Out of the box, `kiri-factory` reads common Drizzle metadata and uses it when building values.

Supported well in `v0.1`:

- enums via `enumValues`
- `varchar(length)` and text length metadata
- nullable columns
- DB-default and generated columns by omission
- common scalar types such as string, number, bigint, boolean, date, json, and arrays
- relation metadata from stable Drizzle `relations(...)` exports when `schema` is provided

Not promised in `v0.1`:

- direct support for Drizzle v2 beta `defineRelations(...)`
- direct many-to-many shortcut builders
- polymorphic relation helpers
- check-constraint-aware generation
- deep `drizzle-seed` integration

## Dialect Support

Factory definitions and relation planning are designed to stay dialect-neutral at the schema layer.

Tested in this repository:

- PostgreSQL tables with PGlite, including nested graph returns
- MySQL tables with a custom adapter for relation planning flows
- SQLite tables with a custom adapter for has-one relation flows and graph returns

Important distinction:

- relation resolution and factory building are cross-dialect
- persistence is adapter-specific

The default adapter uses Drizzle `insert(...).values(...).returning()`, so drivers without `returning()` support should use a custom adapter.

## Linting Definitions

You can ask a runtime to try building each entry once:

```ts
const issues = await factories.lint();
```

This is useful for catching factories that still need explicit build-time overrides.  
`lint()` does not execute `create()`, so adapter-specific failures and create-time persistence errors are out of scope.

## Custom Persistence

By default, the runtime uses Drizzle's `returning()` support.

If your driver needs a different persistence strategy, pass an adapter:

```ts
const factories = createFactories({
  db,
  tables: { users },
  adapter: {
    async create({ db, table, values }) {
      const [row] = await db.insert(table).values(values).returning();
      return row;
    },
  },
});
```

## Tooling

This repository uses:

- `Vite+` for build, test, lint, and type-check
- `vp check` for format + Oxlint + type-aware type-check
- `Vitest` through `vite-plus/test`
