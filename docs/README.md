# Docs

These docs are intentionally split into small Markdown files.

That makes them easier to:

- skim as a human
- link to from issues and pull requests
- load selectively from Codex, Claude Code, or other agent tools

## Start Here

- [Getting started](./getting-started.md)
- [Defining factories](./define-factory.md)
- [Relations and graph returns](./relations.md)
- [Many-to-many patterns](./many-to-many.md)
- [Inference and `CHECK` support](./inference.md)
- [Adapters, dialects, and runtime behavior](./adapters.md)
- [Compatibility and limits](./compatibility.md)

## Suggested Reading Order

1. [Getting started](./getting-started.md)
2. [Defining factories](./define-factory.md)
3. [Relations and graph returns](./relations.md)
4. [Many-to-many patterns](./many-to-many.md)
5. [Inference and `CHECK` support](./inference.md)

If you are using Drizzle RQB v2 already, read [Getting started](./getting-started.md) and [Many-to-many patterns](./many-to-many.md) first.

## Quick Links By Situation

- first install or first runtime: [Getting started](./getting-started.md)
- one table needs traits or transient inputs: [Defining factories](./define-factory.md)
- you want `for(...)`, `hasOne(...)`, `hasMany(...)`, or `createGraph()`: [Relations and graph returns](./relations.md)
- you are modeling many-to-many: [Many-to-many patterns](./many-to-many.md)
- you want to understand what is inferred: [Inference and `CHECK` support](./inference.md)
- you need a custom adapter or care about runtime write behavior: [Adapters, dialects, and runtime behavior](./adapters.md)
- you want the support boundaries first: [Compatibility and limits](./compatibility.md)
