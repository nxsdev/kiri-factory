# Defining Factories

See also:

- [Docs index](./README.md)
- [Getting started](./getting-started.md)
- [Inference and `CHECK` support](./inference.md)
- [Relations](./relations.md)
- [Official `drizzle-seed` overview](https://orm.drizzle.team/docs/seed-overview)
- [Official generator functions](https://orm.drizzle.team/docs/seed-functions)

`createFactories(...)` gives you auto-generated factories from schema metadata.

Use `defineFactory(...)` when one table needs shared logic:

- shared columns
- custom inference
- build-time behavior without a connected DB

## Basic Example

```ts
import { defineFactory } from "kiri-factory";

const userFactory = defineFactory(users, {
  columns: (f) => ({
    role: "member",
    email: f.email(),
    nickname: f.string({ isUnique: true }),
  }),
});

const built = await userFactory.build({
  role: "admin",
});
```

In practice, `columns` should be the default place you reach for first.

- use `columns` for shared fixed values and shared drizzle-seed generators
- use call-site overrides for one-off differences
- use plain helper functions when a business scenario spans multiple tables

## Sharing Official `drizzle-seed` Generators

If you already use `drizzle-seed`, keep its official `refine((f) => ...)` shape as the source of truth for shared columns.

```ts
import { seed } from "drizzle-seed";
import { defineFactory } from "kiri-factory";

const customerFactory = defineFactory(customers, {
  columns: (f) => ({
    status: "active",
    companyName: f.companyName(),
    contactName: f.fullName(),
    contactEmail: f.email(),
  }),
});

const customer = await customerFactory.build();

await seed(db, schema).refine((f) => ({
  customers: {
    count: 1000,
    columns: customerFactory.columns(f),
  },
}));
```

Use this when:

- runtime factories and seed scripts should share the same column generator definitions
- you want to stay close to official `drizzle-seed` docs
- `count`, `with`, and weighted random should remain seed-only concerns

`columns(f)` reuses the same public drizzle-seed generator helpers that the official
`refine((f) => ...)` examples use. Runtime factories do not embed the full seeding engine.

This works because `columns(f)` receives the same public generator surface that
official `drizzle-seed` examples use. If a generator exists in official docs,
you can use that generator explicitly in `columns(f)`.

The important distinction is:

- explicit `columns(f)` usage is encouraged
- plain auto inference only covers the narrower selector path that kiri-factory can keep predictable

## Pure Definitions

Definitions are pure:

- `build()` works without a DB
- `buildMany()` works without a DB
- `create()` belongs to the connected runtime returned by `createFactories(...)`

If you only need fixed values, `columns` can be a plain object:

```ts
const userFactory = defineFactory(users, {
  columns: {
    role: "member",
  },
});
```

## Mixing Auto and Explicit Factories

You do not need to define every table up front.

```ts
const userFactory = defineFactory(users, {
  columns: {
    role: "admin",
  },
});

const factories = createFactories({
  db,
  schema,
  definitions: {
    users: userFactory,
  },
});

await factories.users.create();
await factories.posts.create();
```

This gives you:

- auto-generated factories for tables without definitions
- custom behavior only where you need it

## Looking Up Factories

Property access is the common path:

```ts
await factories.users.create();
```

There is also a fallback lookup API:

```ts
await factories.get("users").create();
await factories.get(users).create();
```

If you want multi-row scenario helpers, continue with [Shared definitions in large test suites](./recipes/shared-definitions.md).  
If your definition needs custom inferred values, continue with [Inference and `CHECK` support](./inference.md).
