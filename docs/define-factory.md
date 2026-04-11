# Defining Factories

See also:

- [Docs index](./README.md)
- [Getting started](./getting-started.md)
- [Inference and `CHECK` guardrails](./inference.md)
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

## Shared Definitions In Large Test Suites

In larger suites, a common pattern is:

1. keep `defineFactory(...)` files close to schema or domain code
2. create one connected runtime per test or test module
3. let most tables stay auto-generated
4. only define factories for domain-heavy tables

```ts
// src/db/factories/users.ts
export const userFactory = defineFactory(users, {
  columns: (f) => ({
    role: "member",
    email: f.email(),
    nickname: f.string({ isUnique: true }),
  }),
});

// test/helpers/create-test-factories.ts
export function createTestFactories(db: Db) {
  return createFactories({
    db,
    schema,
    definitions: {
      users: userFactory,
    },
  });
}
```

If a scenario spans several tables, keep that orchestration in a normal helper
function instead of adding another DSL layer.

## Looking Up Factories

Property access is the common path:

```ts
await factories.users.create();
```

There is also a `get(...)` fallback that accepts either the schema key or the Drizzle table instance:

```ts
await factories.get("users").create();
await factories.get(users).create();
```

The table form is useful when a helper already holds the `Table` reference and does not want to re-derive the registry key.

## Sequence Semantics

Each factory keeps its own monotonic sequence counter. The counter advances on every `build()`, `buildMany()`, `create()`, and `createMany()` call, and feeds into auto-generated values and `drizzle-seed` generators for reproducibility.

Reset a single factory:

```ts
factories.users.resetSequence();
factories.users.resetSequence(100); // the next row will use sequence 101
```

Reset every factory in a registry at once:

```ts
factories.resetSequences();
factories.resetSequences(0);
```

This is the usual hook for test suites that want deterministic values between cases, for example inside a `beforeEach`.

If your definition needs custom inferred values, continue with [Inference and `CHECK` guardrails](./inference.md).
