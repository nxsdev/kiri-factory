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
- [Inference and `CHECK` support](./inference.md)
- [Adapters and transactions](./adapters.md)
- [Compatibility and limits](./compatibility.md)

## Quick Links By Situation

- first install or first runtime: [Getting started](./getting-started.md)
- one table needs shared column definitions: [Defining factories](./define-factory.md)
- you want to connect rows by relation name: [Relations](./relations.md)
- your schema uses junction tables: [Relations](./relations.md)
- you want to understand what is inferred: [Inference and `CHECK` support](./inference.md)
- you need a custom adapter or transaction pattern: [Adapters and transactions](./adapters.md)
- you want support boundaries first: [Compatibility and limits](./compatibility.md)
- your child row depends on multiple foreign-key columns: [Relations](./relations.md)

## Official `drizzle-seed` Docs

Use these when you want the official seeding behavior itself:

- [Seed overview](https://orm.drizzle.team/docs/seed-overview)
- [Generator functions](https://orm.drizzle.team/docs/seed-functions)
- [`with` seeding guide](https://orm.drizzle.team/docs/guides/seeding-using-with-option)
