# SQLite Runtime

`kiri-factory` is tested against SQLite through libSQL in this repository.

Use this recipe when you want a small disposable runtime without leaving the Drizzle API
shape.

## Example

```ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { createFactories } from "kiri-factory";

const client = createClient({ url: ":memory:" });
const db = drizzle(client);

const factories = createFactories({
  db,
  schema,
});
```

## Covered In Tests

The SQLite test suite covers:

- `buildMany()` and `createMany()`
- auto-parent creation
- explicit foreign-key overrides
- same-target relations
- composite foreign keys
- `CHECK` guardrails
- custom-type inference resolvers
- `verifyCreates()`

See `test/sqlite.test.ts`.

## Notes

- this repository uses libSQL for portable test coverage
- if your SQLite driver differs, keep using a custom adapter when needed

## Continue With

- [Compatibility and limits](../compatibility.md)
- [Adapters and transactions](../adapters.md)
