# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Because `kiri-factory` is still on `0.x`, minor releases may contain breaking
changes. See the [versioning guide](./docs/versioning.md) for details.

## [Unreleased]

## [0.1.0]

Initial public release.

### Added

- `createFactories({ db, schema, definitions?, adapter?, inference? })` for the
  stable `relations(...)` entrypoint (`kiri-factory`, also exported as
  `kiri-factory/rqb-v1`).
- `createFactories({ db, relations, definitions?, adapter?, inference? })` for
  the RQB v2 entrypoint (`kiri-factory/rqb-v2`), built for
  `defineRelations(...)`.
- `defineFactory(table, { columns?, inference? })` for reusable per-table
  definitions. `columns` accepts either a plain object or a callback receiving
  the public `drizzle-seed` generator helpers.
- Row APIs: `build()`, `buildMany()`, `create()`, `createMany()`, each advancing
  a per-factory monotonic sequence counter.
- Relation wiring through `for("relation", row)`, with support for same-target
  relation keys and composite foreign keys.
- Implicit single-column parent auto-creation during `create()` / `createMany()`,
  including multi-hop chains across registered tables, per-`createMany()`
  parent caching, and cycle detection that raises an explicit error.
- `FactoryInferenceContext`-driven column inference with resolver lookup order
  (definition `inference.columns` → runtime `inference.columns` → definition
  `inference.customTypes` → runtime `inference.customTypes` → built-in).
- `CHECK` constraint guardrails that parse simple single-column forms
  (`>`, `>=`, `<`, `<=`, `BETWEEN`, `IN (...)`, `<> ''`), merge hints across
  multiple checks on the same column, and throw on unsatisfied defaults.
- `drizzleReturning<DB>()` persistence adapter as the default, plus a
  `FactoryAdapter<DB>` interface for custom adapters and MySQL-style
  insert-then-select flows.
- Registry utilities: property-access lookup, `get(stringKey | Table)`,
  `resetSequence(next?)`, `resetSequences(next?)`, `lint()`, and
  `verifyCreates()` returning `FactoryLintIssue[]`.
- Test coverage against PGlite (Postgres) and libSQL (SQLite), plus MySQL-shaped
  adapter tests.
- Documentation split into small Markdown files under `docs/` for humans and
  agents to consume one topic at a time.

### Known limits

- Automatic transaction wrapping is not provided — tests that need rollback
  should manage transactions themselves. See
  [adapters and transactions](./docs/adapters.md#transactions).
- Only simple single-column `CHECK` forms are parsed. More complex constraints
  must be satisfied via `columns(f)` or call-site overrides.

[Unreleased]: https://github.com/nxsdev/kiri-factory/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nxsdev/kiri-factory/releases/tag/v0.1.0
