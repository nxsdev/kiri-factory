# Relations

See also:

- [Docs index](./README.md)
- [Getting started](./getting-started.md)
- [Compatibility and limits](./compatibility.md)

## `for(...)`

`for(...)` is the main relation helper.

Use it on the child side of a relation.

```ts
const author = await factories.users.create();

const post = await factories.posts.for("author", author).create();
const session = await factories.sessions.for("user", author).create();
```

Both arguments are required:

- the relation key
- the already-created parent row

This keeps ownership, tenancy, and reused parents explicit.

## Reusing One Parent Row

If several rows should belong to the same parent, create the parent once and keep
passing that row back into `for(...)`.

```ts
const author = await factories.users.create({
  email: "author@example.com",
});

const first = await factories.posts.for("author", author).create({
  title: "First",
});

const second = await factories.posts.for("author", author).create({
  title: "Second",
});
```

This keeps:

- parent reuse explicit at the call site
- ownership and tenancy visible in tests
- `createMany()` predictable when several children share one parent

## Return Values

`create()` returns the row for the table you called.

```ts
const post = await factories.posts.for("author", author).create();
```

`createMany(count)` returns an array of rows for that table.

```ts
const posts = await factories.posts.for("author", author).createMany(3);
```

This is intentional. The library helps you connect rows, but it does not change the shape of the returned row into a nested relation object.

## Same-Target Relations

When one table has multiple relations to the same target table, always use the Drizzle relation key.

```ts
const author = await factories.users.create();
const reviewer = await factories.users.create();

const comment = await factories.reviewComments
  .for("author", author)
  .for("reviewer", reviewer)
  .create();
```

## Self Relations

Self relations work the same way.

```ts
const manager = await factories.employees.create({
  name: "Boss",
});

const employee = await factories.employees.for("manager", manager).create({
  name: "Worker",
});
```

## Many-to-Many

Use the junction table explicitly.

```ts
const user = await factories.users.create();
const group = await factories.groups.create();

const membership = await factories.memberships.for("user", user).for("group", group).create({
  role: "owner",
});
```

This is the recommended write path in both:

- stable `relations(...)`
- `kiri-factory/rqb-v2` with `defineRelations(...)`

If the through row has business meaning or required payload columns, explicit junction-table
creation stays the clearest option.

```ts
await factories.memberships.for("member", member).for("group", group).create({
  role: "owner",
});
```

This avoids hiding:

- required payload columns
- timestamps or roles on the through row
- the row you may actually assert on later

## Composite Foreign Keys

Composite foreign keys work best when you use explicit relation planning.

```ts
const version = await factories.orderVersions.create({
  orderId: 100,
  version: 3,
});

const line = await factories.orderVersionLines.for("orderVersion", version).create({
  sku: "SKU-1",
});
```

When relation metadata knows every owned key, `for(...)` copies the full composite key
from the parent row.

What does not work generically is a plain `create()` with missing composite parent keys.
In that case, create the parent first or override the full key directly.

## Step-by-Step Trees

For deeper trees, keep the setup explicit.

```ts
const user = await factories.users.create();
const profile = await factories.profiles.for("user", user).create();
const posts = await factories.posts.for("profile", profile).createMany(2);

const commentsByPost = await Promise.all(
  posts.map((post) => factories.comments.for("post", post).createMany(3)),
);

const comments = commentsByPost.flat();
```

This usually has lower cognitive cost than a deep nested DSL.

## Plain `create()` Does Not Auto-Create Parents

`create()` does not invent missing parent rows for you.

```ts
const author = await factories.users.create();
const post = await factories.posts.for("author", author).create();
```

This is intentional:

- ownership and tenancy stay explicit in tests
- the row you create is the row you asked for
- missing foreign keys fail fast instead of silently creating unrelated parents

If you want support boundaries before using a pattern in production tests, continue with [Compatibility and limits](./compatibility.md).
