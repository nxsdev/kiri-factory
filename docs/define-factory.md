# Defining Factories

See also:

- [Docs index](./README.md)
- [Getting started](./getting-started.md)
- [Inference and `CHECK` support](./inference.md)
- [Relations](./relations.md)

`createFactories(...)` gives you auto-generated factories from schema metadata.

Use `defineFactory(...)` when one table needs shared logic:

- shared `drizzle-seed` column generators
- defaults
- traits
- transient inputs
- custom inference
- build-time behavior without a connected DB

## Basic Example

```ts
import { defineFactory } from "kiri-factory";

const userFactory = defineFactory(users, {
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

const built = await userFactory.withTraits("admin").build();
```

## Sharing Official `drizzle-seed` Generators

If you already use `drizzle-seed`, keep its official `refine((f) => ...)` shape as the source of truth for shared column generators.

```ts
import { seed } from "drizzle-seed";
import { defineFactory } from "kiri-factory";

const customerFactory = defineFactory(customers, {
  columns: (f) => ({
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

See also:

- [Getting started](./getting-started.md)
- [Inference and `CHECK` support](./inference.md)

## Pure Definitions

Definitions are pure:

- `build()` works without a DB
- `buildMany()` works without a DB
- `create()` belongs to the connected runtime returned by `createFactories(...)`

## Recommended Hierarchy

To keep one source of truth per concern:

- put shared column generators in `columns(f)`
- use `defaults` for small fixed literals
- use `state(...)` for runtime-dependent values
- use `traits` as named overlays, not as a second place to redefine everything

## Transient Inputs

Transient values are available inside `state(...)` but are never persisted.

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

const built = await userFactory.build(
  {},
  {
    transient: {
      domain: "kiri.dev",
    },
  },
);
```

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

If you want to attach related rows after this point, continue with [Relations](./relations.md).  
If your definition needs custom inferred values, continue with [Inference and `CHECK` support](./inference.md).
