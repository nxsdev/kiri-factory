# Multi-Tenant Auto-Parents

This pattern matches the tested `managedSessions -> managedUsers -> tenants / roles` chain.

## Multi-Hop Auto-Create

```ts
const factories = createFactories({
  db,
  schema: { managedSessions, managedUsers, roles, tenants },
});

const sessions = await factories.managedSessions.createMany(2, (index) => ({
  token: `token-${index + 1}`,
}));
```

Within the same `createMany(...)` call:

- one tenant is auto-created
- one role is auto-created
- one managed user is auto-created
- both sessions point at that same managed user

## When To Stop Using Auto-Parents

Prefer explicit parents when:

- a hop uses a composite foreign key
- you need a specific tenant / role combination
- a unique rule needs coordinated values
- you want atomic rollback around the whole tree

Then split it into steps:

```ts
const tenant = await factories.tenants.create({ slug: "acme" });
const role = await factories.roles.create({ slug: "owner" });
const user = await factories.managedUsers.create({
  tenantId: tenant.id,
  roleId: role.id,
});

const session = await factories.managedSessions.for("user", user).create();
```

## Source Shape

See `test/factory.test.ts` around the `managedSessions` tests.

## Continue With

- [Relations](../relations.md)
- [Transactions and rollback](./transaction-rollback.md)
