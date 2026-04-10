# Custom Adapter With Insert And Read-Back

See also:

- [Recipes](./README.md)
- [Adapters and transactions](../adapters.md)
- [Inference and `CHECK` support](../inference.md)

If your driver does not support `returning()`, use a custom adapter that inserts first and then reads the row back.

## Example Shape

```ts
const factories = createFactories({
  db,
  schema: { users },
  adapter: {
    async create({ db, table, values }) {
      const result = await db.insert(table).values(values);

      const insertedId = extractInsertedId(result);

      const [row] = await db.select().from(table).where(eq(table.id, insertedId));

      return row!;
    },
  },
});
```

## Notes

- `kiri-factory` handles building and relation planning
- your adapter only has to persist and return the real row
- the exact read-back query depends on your driver and primary key shape

If your tables use composite primary keys, read back using the full key instead of assuming `id`.
