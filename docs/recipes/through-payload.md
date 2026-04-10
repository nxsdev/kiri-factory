# Many-to-Many With Required Through-Table Payload

See also:

- [Recipes](./README.md)
- [Many-to-many patterns](../many-to-many.md)
- [Relations](../relations.md)

If your through table has required payload columns, prefer the explicit junction-table factory instead of direct many-to-many helpers.

## Why

Direct many-to-many helpers are best when the through row is just wiring.

If the through row has business meaning, tests are usually clearer when they create that row directly.

## Example

```ts
const memberships = pgTable("memberships", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id),
  role: text("role").notNull(),
});

const factories = createFactories({
  db,
  schema: {
    members,
    groups,
    memberships,
    membersRelations,
    groupsRelations,
    membershipsRelations,
  },
});

const member = await factories.members.create({ name: "Ada" });
const group = await factories.groups.create({ label: "Core" });

await factories.memberships.for("member", member).for("group", group).create({
  role: "owner",
});
```

## Rule Of Thumb

- through row is pure wiring: explicit junction creation is still fine
- through row has required payload or business meaning: create the junction table directly
