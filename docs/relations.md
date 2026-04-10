# Relations and Graph Returns

See also:

- [Docs index](./README.md)
- [Getting started](./getting-started.md)
- [Many-to-many patterns](./many-to-many.md)
- [Compatibility and limits](./compatibility.md)

## Relation Planning APIs

`kiri-factory` uses three relation-planning methods.

### `for(...)`

Use `for(...)` on the child side of a relation.

```ts
await factories.posts.for("author").create();
await factories.sessions.for("user").create();
```

### `hasOne(...)`

Use `hasOne(...)` on the parent side of an inverse 1:1 relation.

```ts
await factories.users.hasOne("profile").create();
```

### `hasMany(...)`

Use `hasMany(...)` on the parent side of a to-many relation.

```ts
await factories.users.hasMany("posts", 2).create();
```

## Return Values

`create()` returns the root row for the table you called.

```ts
const post = await factories.posts.for("author").create();
```

`createList(count)` returns an array of root rows.

```ts
const posts = await factories.posts.createList(3);
```

`createGraph()` returns the root row plus only the relations you planned explicitly with `for(...)`, `hasOne(...)`, or `hasMany(...)`.

```ts
const graph = await factories.users
  .hasMany("posts", 2, (index) => ({
    title: `Post ${index + 1}`,
  }))
  .createGraph();

graph.row.id;
graph.relations.posts?.[0]?.row.title;
```

Important:

- implicit FK auto-create can still run when needed
- implicit fallback does not appear in graph results
- graph nodes can be either `source: "created"` or `source: "existing"`

## Reusing Existing Rows

Use `existing(table, row)` when a planned relation should reuse a previously created row.

```ts
import { existing } from "kiri-factory";

const author = await factories.users.create();

await factories.posts.for("author", existing(users, author)).create();
```

## Same-Target Relations

When one table has multiple relations to the same target table, always use the Drizzle relation key.

```ts
await factories.comments.for("author").create();
await factories.comments.for("reviewer").create();
```

## Self Relations

Self relations work as long as the chain can terminate.

```ts
await factories.employees.for("manager").create();
await factories.employees.hasMany("reports", 2).createGraph();
```

## FK Auto-Create Fallback

Table-only runtimes can still create simple parents from foreign-key metadata.

```ts
const factories = createFactories({
  db,
  tables: { users, posts },
});

const post = await factories.posts.create();
```

This mode is intentionally narrow:

- only for simple foreign keys that can be read safely
- composite foreign keys are intentionally excluded from this fallback
- use explicit relation planning when a parent key spans multiple columns
- mainly a fallback
- not the main graph API

If you are working on many-to-many specifically, continue with [Many-to-many patterns](./many-to-many.md).  
If you want support boundaries before using a pattern in production tests, continue with [Compatibility and limits](./compatibility.md).
