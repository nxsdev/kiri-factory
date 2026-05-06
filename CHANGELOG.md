# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Because `kiri-factory` is still on `0.x`, minor releases may contain breaking
changes. See the [versioning guide](./docs/versioning.md) for details.

## [Unreleased]

## [0.1.2]

### Added

- Add named factory traits through `defineFactory(table, { traits })`, exposed
  as `factory.traits.name`.
- Export trait-related public types from both stable and `rqb-v2` entrypoints.

### Changed

- Remove the public `for(...)` relation-wiring API. Reuse known parent rows by
  passing owned foreign-key columns through normal call-site overrides instead.
- Simplify the README so the main usage, traits, relations, entrypoints, and
  publishing workflow are understandable from one file.
- Update relation docs and examples around explicit foreign-key overrides.

## [0.1.1]

### Changed

- Published npm metadata for the Drizzle 1.0 RC line.

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
- Public `seed` support on `createFactories(...)` and `FactoryBinding`, with
  `FactoryRegistry#getSeed()` for inspection.
- Test coverage against PGlite (Postgres) and libSQL (SQLite), plus MySQL-shaped
  adapter tests.
- Documentation split into small Markdown files under `docs/` for humans and
  agents to consume one topic at a time.
- Docs and examples updated to explain the deterministic generator path more
  directly.

### Fixed

- Publish the `kiri-factory/rqb-v2` entrypoint from `dist/rqb-v2` and verify
  exported files are present in the npm tarball before release.
- Externalize `drizzle-orm` and `drizzle-seed` from the `rqb-v2` build so the
  published tarball stays small and does not embed a mismatched Drizzle runtime.

### Changed

- Broaden the `drizzle-orm` peer install range to reduce friction across stable
  and beta Drizzle releases while keeping the tested matrix documented
  separately.
- Pin the runtime `drizzle-seed` dependency to a publish-safe semver range in
  `package.json`.
- Make the tag-driven release workflow publish with `pnpm` and create the
  matching GitHub Release from `CHANGELOG.md`.

### Known limits

- Automatic transaction wrapping is not provided — tests that need rollback
  should manage transactions themselves. See
  [adapters and transactions](./docs/adapters.md#transactions).
- Only simple single-column `CHECK` forms are parsed. More complex constraints
  must be satisfied via `columns(f)` or call-site overrides.

[Unreleased]: https://github.com/nxsdev/kiri-factory/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/nxsdev/kiri-factory/compare/v0.1.0...v0.1.2
[0.1.1]: https://www.npmjs.com/package/kiri-factory/v/0.1.1
[0.1.0]: https://github.com/nxsdev/kiri-factory/releases/tag/v0.1.0
