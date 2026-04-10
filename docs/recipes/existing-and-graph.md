# Reusing Parent Rows

See also:

- [Recipes](./README.md)
- [Relations](../relations.md)

Reuse is just a row passed to `for(...)`.

## Example

```ts
const author = await factories.users.create({
  email: "author@example.com",
  nickname: "author",
});

const first = await factories.posts.for("author", author).create({
  title: "First",
});

const second = await factories.posts.for("author", author).create({
  title: "Second",
});
```

## What You Get

- no duplicate parent row
- no wrapper function around the row
- explicit reuse at the call site

## When To Prefer This

- one account owns many records in the same test
- one tenant or organization should be shared across several creates
- the reused row has custom state that should not be regenerated
