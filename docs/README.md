# Docs

These docs are intentionally split into small Markdown files.

That makes them easier to:

- skim as a human
- link from issues and pull requests
- load selectively from Codex, Claude Code, or other agents

## Start Here

- [Getting started](./getting-started.md)
- [Defining factories](./define-factory.md)
- [Relations](./relations.md)
- [Many-to-many patterns](./many-to-many.md)
- [Inference and `CHECK` support](./inference.md)
- [Adapters and transactions](./adapters.md)
- [Compatibility and limits](./compatibility.md)
- [Recipes](./recipes/README.md)

## Suggested Reading Order

1. [Getting started](./getting-started.md)
2. [Defining factories](./define-factory.md)
3. [Relations](./relations.md)
4. [Many-to-many patterns](./many-to-many.md)
5. [Inference and `CHECK` support](./inference.md)

## Quick Links By Situation

- first install or first runtime: [Getting started](./getting-started.md)
- one table needs traits or transient inputs: [Defining factories](./define-factory.md)
- you want to connect rows by relation name: [Relations](./relations.md)
- your schema uses junction tables: [Many-to-many patterns](./many-to-many.md)
- you want to understand what is inferred: [Inference and `CHECK` support](./inference.md)
- you need a custom adapter or transaction pattern: [Adapters and transactions](./adapters.md)
- you want support boundaries first: [Compatibility and limits](./compatibility.md)
- you want concrete real-world examples: [Recipes](./recipes/README.md)
- your child row depends on multiple foreign-key columns: [Composite foreign keys](./recipes/composite-foreign-keys.md)
