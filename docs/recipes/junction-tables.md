# Junction Tables

Use the junction row directly.

`kiri-factory` does not create many-to-many links without the actual through table.

## Stable Relations Example

```ts
const user = await factories.users.create();
const group = await factories.groups.create();

const membership = await factories.memberships.create({
  memberId: user.id,
  groupId: group.id,
  role: "owner",
});
```

## RQB v2 Example

```ts
const user = await factories.users.create();
const group = await factories.groups.create();

const membership = await factories.usersToGroups.create({
  userId: user.id,
  groupId: group.id,
  role: "owner",
});
```

Why this stays explicit:

- the junction row is the thing being tested
- any payload columns stay visible at the call site
- relation ownership stays unambiguous

## Source Shape

See:

- `test/factory.test.ts` for `memberships`
- `packages/rqb-v2/test/rqb-v2.test.ts` for `usersToGroups`

## Continue With

- [Relations](../relations.md)
- [Versioning](../versioning.md)
