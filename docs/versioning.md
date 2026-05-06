# Versioning

This page explains entrypoints, peer dependency ranges, and the current `0.x` release posture.

## Current Release Shape

`kiri-factory` is currently `0.1.x`.

That means:

- the package is published and intended for real use
- small API changes are still possible between minor releases
- docs and tests are the best source of truth for sharp edges

See [CHANGELOG](../CHANGELOG.md) for release notes.

## Entrypoints

Use one of these imports:

| Import                | Use when                                                              |
| --------------------- | --------------------------------------------------------------------- |
| `kiri-factory`        | your project uses stable `relations(...)`                             |
| `kiri-factory/rqb-v1` | you want an explicit stable alias                                     |
| `kiri-factory/rqb-v2` | your project uses beta `defineRelations(...)` / Relational Queries v2 |

Notes:

- `kiri-factory` and `kiri-factory/rqb-v1` point to the same build
- `kiri-factory/rqb-v2` is built from `packages/rqb-v2` and published from `dist/rqb-v2`
- the public API is intentionally kept as close as possible across both paths

## Switching Between `rqb-v1` And `rqb-v2`

From stable to v2:

1. change the import to `kiri-factory/rqb-v2`
2. replace `schema` with `relations` in `createFactories(...)`
3. pass the object returned by `defineRelations(...)`
4. keep `defineFactory(...)`, adapters, and inference options the same

From v2 to stable:

1. change the import back to `kiri-factory`
2. pass the schema object that exports tables and `relations(...)`
3. keep the rest of the factory code the same where possible

## `drizzle-orm` Range

Current peer dependency:

```txt
>=0.36.4 <1 || >=1.0.0-beta.1 <2
```

Repository test coverage today:

- stable entrypoint: `drizzle-orm` `0.45.x`
- rqb-v2 entrypoint: Drizzle's current beta `Relational Queries v2` path on `drizzle-orm` `1.0.0-beta.21`

The peer range is intentionally broader than the test matrix so consumers are not blocked on
install when moving across compatible Drizzle releases, especially on the beta path.

If you are outside those tested ranges, prefer trying the test suite in your app before
adopting the package widely.

## Node And Module Format

Requirements:

- ESM only
- Node `^20.19.0 || >=22.12.0`

Repository CI currently runs on Node 22.
The package range still includes Node 20.19+ because that is the supported runtime floor.

## Dialect Coverage

Runtime coverage in this repository:

- Postgres through `PGlite`
- SQLite through libSQL
- MySQL-style adapter behavior through custom adapter tests

Schema introspection also reads Drizzle metadata for:

- `pg-core`
- `mysql-core`
- `sqlite-core`
- `gel-core`
- `singlestore-core`

Continue with [Compatibility and limits](./compatibility.md).

## Release Notes

The release process is conventional:

- user-facing behavior goes in [CHANGELOG](../CHANGELOG.md)
- CI runs `check`, `test`, and `build`
- release tags (`v*`) publish to npm with `pnpm publish`
- the release workflow creates a GitHub Release from the matching `CHANGELOG.md` section
- `prepublishOnly` runs the same guardrail locally

## Continue With

- [API reference](./api.md)
- [Compatibility and limits](./compatibility.md)
- [FAQ](./faq.md)
