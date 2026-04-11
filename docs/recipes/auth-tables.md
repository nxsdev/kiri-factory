# Auth Tables

Use this pattern when your schema has users plus auth-side children such as accounts or
sessions.

## Explicit Parent Wiring

```ts
const factories = createFactories({ db, schema });

const user = await factories.users.create({
  email: "alice@example.com",
});

const account = await factories.accounts.for("user", user).create({
  providerId: "github",
  accountId: "alice-gh",
});

const session = await factories.sessions.for("user", user).create();
```

Why this shape works well:

- one explicit parent row
- no duplicated foreign-key values
- `session.userId` and `account.userId` stay driven by relation metadata

## Auto-Parent For The Smallest Case

When a child has one required parent and the parent table is part of the runtime,
`create()` can auto-create it:

```ts
const factories = createFactories({
  db,
  schema: { users, sessions, usersRelations, sessionsRelations },
});

const session = await factories.sessions.create({
  token: "session-token",
});
```

That is convenient for small tests.
As soon as the parent needs coordination or shared values, move back to an explicit
`user`.

## Source Shape

See:

- `README.md`
- `test/sqlite.test.ts`

## Continue With

- [Relations](../relations.md)
- [Transactions and rollback](./transaction-rollback.md)
