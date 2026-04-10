# Relations

See also:

- [Docs index](./README.md)
- [Getting started](./getting-started.md)
- [Many-to-many patterns](./many-to-many.md)
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

If you are working on many-to-many specifically, continue with [Many-to-many patterns](./many-to-many.md).  
If you want support boundaries before using a pattern in production tests, continue with [Compatibility and limits](./compatibility.md).
