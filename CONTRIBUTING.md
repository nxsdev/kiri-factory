# Contributing

Thanks for your interest in `kiri-factory`. This project is small and opinionated,
so a short explanation up front tends to save everyone time.

## Before You Open A PR

- Please open an issue first for anything larger than a typo or a one-line fix.
  That gives us a chance to agree on scope before you spend time.
- Bug reports are always welcome. A failing test case is the fastest way to get
  a bug fixed.
- Feature requests should include the concrete problem you are trying to solve.
  `kiri-factory` intentionally stays narrow; see the [FAQ](./docs/faq.md) for
  what is in scope and what belongs to `drizzle-seed` instead.

## Local Setup

Requirements:

- Node `^20.19.0 || >=22.12.0`
- `pnpm` 10.4.1 (the version pinned by `packageManager` in `package.json`)

```bash
pnpm install
pnpm setup:hooks    # installs the repo-local Vite+ hooks (pre-commit runs `vp staged`)
```

## Common Commands

```bash
pnpm check          # typecheck + lint the workspace
pnpm test           # run the full test suite (rqb-v1 + rqb-v2)
pnpm build          # build both entrypoints
pnpm test:watch     # interactive watch mode
```

Scoped variants for faster iteration:

```bash
pnpm check:pkg
pnpm test:pkg
pnpm check:rqb-v2
pnpm test:rqb-v2
```

## Project Layout

```
src/                   # rqb-v1 source (stable `relations(...)`)
test/                  # rqb-v1 tests (pglite, sqlite, unit)
packages/rqb-v2/       # rqb-v2 source + tests (defineRelations)
docs/                  # user-facing documentation
.github/workflows/     # CI + release pipelines
```

The two entrypoints share the same public surface as much as possible. When
adding behavior, keep the two sides in sync unless one of them explicitly
doesn't support the feature.

## Tests

- Prefer writing tests against the real database driver (`PGlite`, `libsql`)
  rather than mocks. Runtime coverage is the whole point of this library.
- A test that reproduces a bug is more valuable than a description of it.
- Both `src/` and `packages/rqb-v2/` tests should pass before you open a PR.

## Coding Style

`vp check` runs both the type checker and the linter. The pre-commit hook
applies `vp check --fix` to staged files, so formatting is usually handled for
you. If the hook fails, fix the reported issue and re-stage — don't bypass it
with `--no-verify`.

## Commit Messages

Short, imperative commit messages are preferred:

```
Expand implicit parent auto-create
Clarify inference and guardrail docs
```

You don't need to match an exact convention, just aim for something that reads
cleanly in `git log`.

## Pull Requests

- Link the issue you are addressing when one exists.
- Keep PRs focused. Two small PRs are almost always better than one large one.
- CI must be green (`check`, `test`, `build`) before merge.
- A reviewer may ask for a test or doc update; that is part of the normal flow,
  not a rejection.

## Releases

The recommended release flow is tag-driven:

1. update `package.json` and move the relevant notes from `Unreleased` in [CHANGELOG.md](./CHANGELOG.md) into a matching version section such as `## [0.1.1]`
2. commit the release changes
3. create and push a tag like `v0.1.1`

Pushing the tag runs the release workflow, which verifies the build, publishes to npm with `pnpm publish`, and creates the matching GitHub Release from `CHANGELOG.md`.

## Reporting Security Issues

Please do **not** file security reports as public issues. Follow the
[security policy](./SECURITY.md) instead.

## Code Of Conduct

Participation in this project is governed by the
[Contributor Covenant](./CODE_OF_CONDUCT.md). By contributing, you agree to
uphold it.
