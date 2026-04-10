# Many-to-Many Patterns

See also:

- [Docs index](./README.md)
- [Getting started](./getting-started.md)
- [Relations](./relations.md)
- [Compatibility and limits](./compatibility.md)

`kiri-factory` models many-to-many through the junction table.

That is the same recommendation for both:

- stable `relations(...)`
- `defineRelations(...)` in `kiri-factory/rqb-v2`

## Preferred Pattern

Create the two endpoint rows, then create the through row explicitly.

```ts
const user = await factories.users.create();
const group = await factories.groups.create();

const membership = await factories.memberships.for("user", user).for("group", group).create({
  role: "owner",
});
```

This stays readable when:

- the through table has payload columns
- the through row matters in assertions
- the relationship gets reused in helpers

## Why Not Direct `users.groups` Creation?

Direct many-to-many planning looks attractive, but in tests the through row often matters:

- it may have required payload columns
- it may carry timestamps or roles
- it may be the thing you actually assert on

The explicit junction-table route avoids hiding that row.

## Stable and RQB v2

The write pattern stays the same across both relation systems.

Stable:

```ts
const membership = await factories.memberships.for("member", member).for("group", group).create();
```

RQB v2:

```ts
const membership = await factories.usersToGroups.for("user", user).for("group", group).create();
```

The difference is only which relation metadata supplies the typed keys.

If your through table has required payload columns, continue with [Many-to-many with required through-table payload](./recipes/through-payload.md).  
If you want the general relation helper rules first, continue with [Relations](./relations.md).
