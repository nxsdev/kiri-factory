# Security Policy

`kiri-factory` is a test-factory library for Drizzle ORM. It is expected to run
against local databases inside a test suite, so the realistic threat model is
small. That said, we take reports seriously and will respond.

## Supported Versions

`kiri-factory` is in `0.x`. Only the latest minor line receives fixes.

| Version | Supported |
| ------- | --------- |
| `0.1.x` | Yes       |
| `< 0.1` | No        |

## Reporting A Vulnerability

**Please do not open a public GitHub issue for security problems.**

Use GitHub's private vulnerability reporting flow instead:

- Go to <https://github.com/nxsdev/kiri-factory/security/advisories/new>
- Fill in a short description, affected version, and reproduction steps
- A maintainer will acknowledge the report and work with you on a fix

If the GitHub flow is not usable for you, open a minimal public issue titled
`"Security contact request"` **without** any details, and a maintainer will
reply with an alternate channel.

## What To Include

A good report usually has:

- the version of `kiri-factory` and `drizzle-orm`
- a minimal reproduction (schema excerpt, factory definition, call site)
- the observed behavior, and why you believe it is a security issue
- any suggested mitigation, if you have one

You do not need a proof of concept for the report to be accepted.

## Scope

In scope:

- unsafe SQL being emitted by `kiri-factory` itself
- `CHECK` guardrails or inference logic that silently produce rows violating
  stated constraints
- crashes or hangs triggered by untrusted schema metadata

Out of scope:

- issues that only reproduce with a forked or manually patched build
- vulnerabilities in `drizzle-orm`, `drizzle-seed`, or database drivers — please
  report those upstream
- misuse inside production code paths (`kiri-factory` is a test-time library)

## Disclosure

We prefer coordinated disclosure. Once a fix is released, the advisory will be
published with credit to the reporter unless you ask to remain anonymous.
