# Reusing Existing Rows Inside Graph Flows

See also:

- [Recipes](./README.md)
- [Relations and graph returns](../relations.md)

Use `existing(table, row)` when one related row should be reused across many creates or graphs.

## Example

```ts
import { existing } from "kiri-factory";

const author = await factories.users.create({
  email: "author@example.com",
  nickname: "author",
});

const first = await factories.posts.for("author", existing(users, author)).createGraph({
  title: "First",
});

const second = await factories.posts.for("author", existing(users, author)).createGraph({
  title: "Second",
});
```

## What You Get

- no duplicate parent row
- graph output marks that branch as `source: "existing"`
- your test setup stays explicit about reuse

## When To Prefer This

- one account owns many records in the same test
- one tenant or organization should be shared across several graphs
- the reused row has custom state that should not be regenerated
