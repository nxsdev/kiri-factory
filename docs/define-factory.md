# Defining Factories

See also:

- [Docs index](./README.md)
- [Getting started](./getting-started.md)
- [Inference and `CHECK` support](./inference.md)
- [Relations and graph returns](./relations.md)

`createFactories(...)` gives you auto-generated factories from schema metadata.

Use `defineFactory(...)` when one table needs shared logic:

- stable defaults
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

## Pure Definitions

Definitions are pure:

- `build()` works without a DB
- `buildList()` works without a DB
- `create()` belongs to the connected runtime returned by `createFactories(...)`

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

If you want to attach related rows after this point, continue with [Relations and graph returns](./relations.md).  
If your definition needs custom inferred values, continue with [Inference and `CHECK` support](./inference.md).
