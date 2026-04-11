# API Reference

This page lists the public surface that `kiri-factory` exports.

It is intentionally hand-written.
That keeps the docs small and lets the important boundaries stay visible.

## Stable Entrypoint

```ts
import {
  createFactories,
  defineFactory,
  drizzleReturning,
  type CreateFactoriesOptions,
  type DefineFactoryOptions,
  type FactoryAdapter,
  type FactoryBinding,
  type FactoryInferenceContext,
  type FactoryInferenceOptions,
  type FactoryInferenceResolver,
  type FactoryLintIssue,
  type FactoryRegistry,
  type FactorySeedColumns,
  type FactorySeedColumnsInput,
  type FactorySeedFunctions,
  type FactorySeedGenerator,
  type RuntimeFactory,
} from "kiri-factory";
```

`kiri-factory/rqb-v1` is the same surface as `kiri-factory`.

Use it only when an explicit alias helps your app code stay readable.

## RQB v2 Entrypoint

```ts
import { createFactories, defineFactory, drizzleReturning } from "kiri-factory/rqb-v2";
```

The exported names match the stable entrypoint.
The only runtime difference is the input shape for `createFactories(...)`:

- stable entrypoint: `schema`
- rqb-v2 entrypoint: `relations`

`kiri-factory/rqb-v2` also exports two extra helper types:

- `FactoryColumnValue`
- `FactoryColumnsDefinition`

## `defineFactory(table, options?)`

```ts
function defineFactory<TTable extends Table>(
  table: TTable,
  options?: DefineFactoryOptions<TTable>,
): FactoryDefinition<TTable>;
```

`DefineFactoryOptions<TTable>`:

```ts
type DefineFactoryOptions<TTable extends Table> = {
  columns?: FactorySeedColumnsInput<TTable>;
  inference?: FactoryInferenceOptions<TTable>;
};
```

`FactoryDefinition<TTable>` methods:

```ts
interface FactoryDefinition<TTable extends Table> {
  columns(f: FactorySeedFunctions): FactorySeedColumns<TTable>;
  resetSequence(next?: number): void;
  build(overrides?: Partial<InferInsertModel<TTable>>): Promise<InferInsertModel<TTable>>;
  buildMany(
    count: number,
    overrides?:
      | Partial<InferInsertModel<TTable>>
      | ((index: number) => Partial<InferInsertModel<TTable>>),
  ): Promise<InferInsertModel<TTable>[]>;
}
```

Use `defineFactory(...)` when you want one reusable module per table.

Continue with [Defining factories](./define-factory.md).

## `createFactories(...)`

Stable entrypoint:

```ts
type CreateFactoriesOptions<DB, TSchema> = {
  db: DB;
  schema: TSchema;
  definitions?: Partial<Record<string, FactoryDefinition<any>>>;
  adapter?: FactoryAdapter<DB>;
  inference?: FactoryInferenceOptions<Table>;
  seed?: number;
};

function createFactories<DB, TSchema>(
  options: CreateFactoriesOptions<DB, TSchema>,
): FactoryRegistry<TSchema>;
```

RQB v2 entrypoint:

```ts
type CreateFactoriesOptions<DB, TRelations> = {
  db: DB;
  relations: TRelations;
  definitions?: Partial<Record<string, FactoryDefinition<any>>>;
  adapter?: FactoryAdapter<DB>;
  inference?: FactoryInferenceOptions<Table>;
  seed?: number;
};
```

## Runtime Factories

Each property on the returned registry is a connected runtime factory:

```ts
interface RuntimeFactory<TTable extends Table> extends FactoryDefinition<TTable> {
  create(overrides?: Partial<InferInsertModel<TTable>>): Promise<InferSelectModel<TTable>>;
  createMany(
    count: number,
    overrides?:
      | Partial<InferInsertModel<TTable>>
      | ((index: number) => Partial<InferInsertModel<TTable>>),
  ): Promise<InferSelectModel<TTable>[]>;
  for(relation: string, input: InferSelectModel<any>): RuntimeFactory<TTable>;
}
```

Important notes:

- `build()` / `buildMany()` stay in memory
- `create()` / `createMany()` persist through the configured adapter
- `for(...)` is typed only for child-side one-relations
- `resetSequence(next?)` is available on both definitions and runtime factories

Continue with [Relations](./relations.md).

## Registries

The registry exposes one property per table plus helper methods:

```ts
interface FactoryRegistry<...> {
  get(keyOrTable: string | Table): RuntimeFactory<any>;
  getSeed(): number;
  resetSequences(next?: number): void;
  lint(): Promise<FactoryLintIssue[]>;
  verifyCreates(): Promise<FactoryLintIssue[]>;
}
```

Notes:

- `get("users")` and `get(users)` are both supported
- `getSeed()` returns the configured public seed
- `resetSequences()` resets every factory in the registry
- `lint()` runs `build()` across the runtime
- `verifyCreates()` runs `createMany(2)` across the runtime

`FactoryLintIssue`:

```ts
type FactoryLintIssue = {
  key: string;
  table: string;
  error: Error;
};
```

Continue with [Troubleshooting](./troubleshooting.md).

## Adapters

```ts
interface FactoryAdapter<DB = unknown> {
  create<TTable extends Table>(args: {
    db: DB;
    table: TTable;
    values: InferInsertModel<TTable>;
  }): Promise<InferSelectModel<TTable>>;
}

type FactoryBinding<DB = unknown> = {
  db: DB;
  adapter: FactoryAdapter<DB>;
  seed?: number;
};

function drizzleReturning<DB>(): FactoryAdapter<DB>;
```

`drizzleReturning()` is the default adapter used by `createFactories(...)`.

Use a custom adapter when your driver does not support `returning()`.

`seed` is optional on both `createFactories(...)` and `FactoryBinding`.
When omitted, the default is `0`.

Continue with [Adapters and transactions](./adapters.md).

## Inference Types

`FactoryInferenceContext`:

```ts
type FactoryInferenceContext<TTable extends Table = Table> = {
  table: TTable;
  tableName: string;
  column: Column;
  columnKey: string;
  sequence: number;
  sqlType: string;
  dataType?: string;
  columnType?: string;
};
```

`FactoryInferenceOptions`:

```ts
type FactoryInferenceOptions<TTable extends Table = Table> = {
  checks?: boolean;
  columns?: Record<string, FactoryInferenceResolver<TTable>>;
  customTypes?: Record<string, FactoryInferenceResolver<TTable>>;
};
```

`FactoryInferenceResolver`:

```ts
type FactoryInferenceResolver<TTable extends Table = Table> = (
  context: FactoryInferenceContext<TTable>,
) => unknown;
```

Resolver lookup order:

1. definition-level `inference.columns["table.column"]`
2. definition-level `inference.columns["column"]`
3. runtime-level `inference.columns["table.column"]`
4. runtime-level `inference.columns["column"]`
5. definition-level `inference.customTypes[...]`
6. runtime-level `inference.customTypes[...]`
7. built-in heuristics

Continue with [Inference and `CHECK` guardrails](./inference.md).

## Shared `columns(f)` Types

```ts
type FactorySeedFunctions = ReturnType<typeof getGeneratorsFunctions>;
type FactorySeedGenerator = ReturnType<FactorySeedFunctions[keyof FactorySeedFunctions]>;

type FactoryColumnValue<TTable, TKey> =
  | FactorySeedGenerator
  | InferInsertModel<TTable>[TKey];

type FactoryColumnsDefinition<TTable> = Partial<Record<keyof InferInsertModel<TTable>, ...>>;

type FactorySeedColumns<TTable> = Partial<
  Record<keyof InferInsertModel<TTable>, FactorySeedGenerator>
>;

type FactorySeedColumnsInput<TTable> =
  | Partial<Record<keyof InferInsertModel<TTable>, FactorySeedGenerator | unknown>>
  | ((f: FactorySeedFunctions) => Partial<Record<keyof InferInsertModel<TTable>, unknown>>);
```

Use these only when you need exact typing in app-local helpers.

Most users can just write `columns: (f) => ({ ... })`.

## Continue With

- [Getting started](./getting-started.md)
- [Defining factories](./define-factory.md)
- [Relations](./relations.md)
- [Adapters and transactions](./adapters.md)
