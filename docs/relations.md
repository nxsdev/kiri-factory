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

## Implicit Parent Convenience

`create()` and `createMany()` can auto-create missing single-column parents.

This happens after applying:

- inferred values
- `columns(f)`
- call-site overrides
- explicit `for(...)` plans

```ts
const session = await factories.sessions.create();
```

If `sessions.userId` is the only missing required single-column parent key,
`kiri-factory` creates one `user` row first and then creates the `session`.

Within one `createMany(...)` call, that auto-created parent is shared:

```ts
const sessions = await factories.sessions.createMany(3);
// -> one fresh user, three sessions all pointing at that user
```

Separate `create()` calls still create separate fresh parents.

## Multi-Hop Auto-Parents

Auto-parent creation walks single-column foreign keys across several tables in one step. Every hop must use a single-column foreign key, and every parent table must be registered in the runtime.

```ts
const factories = createFactories({
  db,
  schema: { managedSessions, managedUsers, roles, tenants },
});

const sessions = await factories.managedSessions.createMany(2);
// -> one tenant, one role, one managedUser, two managedSessions
```

Within the same `createMany(...)`, auto-created parents are cached per local key, so every session in the batch points at the same `managedUser`, which in turn points at the same `tenant` and `role`.

If any step in the chain cannot be auto-resolved (composite FK, missing table, unsatisfied `CHECK`, unique constraint, …), the whole chain fails before any insert is issued.

## Cycles

If the foreign-key chain loops back on itself, `kiri-factory` refuses to auto-create the parent and throws:

> Could not auto-create "..." for "..." because the foreign-key chain is cyclic. Add explicit overrides, columns(f), or for(...).

Break the cycle at the call site with `for(...)`, a call-site override, or a shared `columns(f)` entry.

## Auto-Parents Are Not Transactional

`create()` and `createMany()` do not open a transaction around the parent and child inserts. If an auto-created parent has already been persisted and the child insert later fails at the database layer, only the caller's own transaction boundary can roll the parent back.

Wrap the whole scenario in your own transaction when you want atomicity. See [Adapters and transactions](./adapters.md#transactions) for the pattern.

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

## Auth-Style Setup

This row-first flow works well for common auth tables such as `users`, `accounts`,
`sessions`, and `verifications`.

```ts
const user = await factories.users.create({
  email: "alice@example.com",
});

const account = await factories.accounts.for("user", user).create({
  providerId: "github",
  accountId: "github-user-123",
});

const session = await factories.sessions.for("user", user).create();
const verification = await factories.verifications.create({
  identifier: user.email,
});
```

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

When you want a specific existing or shared parent, keep it explicit with
`for(...)` or direct overrides.

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

## Plain `create()` Boundaries

Implicit parent creation is intentionally narrow.

- one missing single-column parent: auto-create it
- multiple missing single-column parents: auto-create each available parent table
- composite foreign keys: require `for(...)` or overrides
- many-to-many through rows: create them explicitly

If you want support boundaries before using a pattern in production tests, continue with [Compatibility and limits](./compatibility.md).
