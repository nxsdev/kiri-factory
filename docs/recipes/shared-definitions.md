# Shared Definitions In Large Test Suites

See also:

- [Recipes](./README.md)
- [Defining factories](../define-factory.md)
- [Getting started](../getting-started.md)

If your project has a large real-database suite, the usual pattern is:

1. keep `defineFactory(...)` files close to schema or domain code
2. create one connected runtime per test or test module
3. let most tables stay auto-generated
4. only define factories for domain-heavy tables

## Example Layout

```text
src/
  db/
    schema/
    factories/
      users.ts
      organizations.ts
      billing.ts
test/
  helpers/
    create-test-factories.ts
```

## Example

```ts
// src/db/factories/users.ts
export const userFactory = defineFactory(users, {
  defaults: {
    role: "member",
  },
  state: ({ seq }) => ({
    email: `user-${seq}@example.com`,
    nickname: `user-${seq}`,
  }),
});

// test/helpers/create-test-factories.ts
export function createTestFactories(db: Db) {
  return createFactories({
    db,
    schema,
    definitions: {
      users: userFactory,
      organizations: organizationFactory,
    },
  });
}
```

## Why This Scales

- schema inference covers most tables
- shared definitions keep business-heavy tables readable
- tests still create data from one connected runtime
