import type {
  ExtractTableRelationsFromSchema,
  InferSelectModel,
  Many,
  One,
  Table,
} from "drizzle-orm";

import {
  type AutoFactory,
  FACTORY_INSTANCE,
  type ExistingRow,
  type FactoryGraphNode,
  type FactoryBuildHook,
  type FactoryCallOptions,
  type FactoryCreateHook,
  type FactoryOverrides,
  type FactoryStateInput,
  type FactoryTraitDefinition,
  fromTable,
} from "./core";
import { type FactoryDefinition } from "./define";
import { drizzleReturning } from "./drizzle";
import { isTable, tableNameOf } from "./internal/drizzle-introspection";
import { extractRuntimeRelations } from "./internal/drizzle-relations";
import type { FactoryAdapter, FactoryBinding } from "./types";

type SchemaMap = Record<string, unknown>;
type TableMap = Record<string, Table>;
type FactoryTransient = Record<string, unknown>;
type AnyDefinition = FactoryDefinition<Table, FactoryTransient>;
type DefinitionMap<TTables extends TableMap> = Partial<{
  [K in keyof TTables]: FactoryDefinition<TTables[K], FactoryTransient>;
}>;
type ExtractTables<TSchema extends SchemaMap> = {
  [K in keyof TSchema as TSchema[K] extends Table ? K : never]: Extract<TSchema[K], Table>;
};
type DefinitionTransient<TValue> =
  TValue extends FactoryDefinition<Table, infer TTransient> ? TTransient : {};
type SchemaTableByDbName<TSchema extends SchemaMap, TDbName extends string> = Extract<
  {
    [K in keyof TSchema]: TSchema[K] extends Table
      ? TSchema[K]["_"]["name"] extends TDbName
        ? TSchema[K]
        : never
      : never;
  }[keyof TSchema],
  Table
>;
type SchemaRelationsForTable<
  TSchema extends SchemaMap,
  TTable extends Table,
> = ExtractTableRelationsFromSchema<TSchema, TTable["_"]["name"]>;
type RelationKeysOfKind<TRelations, TKind> = {
  [K in keyof TRelations]-?: TRelations[K] extends TKind ? K : never;
}[keyof TRelations] &
  string;
type OneRelationKeys<TSchema extends SchemaMap, TTable extends Table> = RelationKeysOfKind<
  SchemaRelationsForTable<TSchema, TTable>,
  One<any, any>
>;
type ManyRelationKeys<TSchema extends SchemaMap, TTable extends Table> = RelationKeysOfKind<
  SchemaRelationsForTable<TSchema, TTable>,
  Many<any>
>;
type RelationTargetTable<
  TSchema extends SchemaMap,
  TTable extends Table,
  TKey extends keyof SchemaRelationsForTable<TSchema, TTable>,
> = SchemaTableByDbName<
  TSchema,
  NonNullable<SchemaRelationsForTable<TSchema, TTable>[TKey]>["referencedTableName"]
>;
type RelationGraphValue<
  TSchema extends SchemaMap,
  TTable extends Table,
  TKey extends keyof SchemaRelationsForTable<TSchema, TTable>,
> =
  SchemaRelationsForTable<TSchema, TTable>[TKey] extends Many<any>
    ? Array<RelationalFactoryGraphNode<TSchema, RelationTargetTable<TSchema, TTable, TKey>>>
    : RelationalFactoryGraphNode<TSchema, RelationTargetTable<TSchema, TTable, TKey>>;
type RelationGraphRelations<TSchema extends SchemaMap, TTable extends Table> = Partial<{
  [K in keyof SchemaRelationsForTable<TSchema, TTable> & string]: RelationGraphValue<
    TSchema,
    TTable,
    K
  >;
}>;
type Simplify<T> = { [K in keyof T]: T[K] } & {};

type RuntimeForKey<
  TTables extends TableMap,
  TDefinitions extends DefinitionMap<TTables>,
  TKey extends keyof TTables,
> = RuntimeFactory<
  TTables[TKey],
  TKey extends keyof TDefinitions ? DefinitionTransient<NonNullable<TDefinitions[TKey]>> : {}
>;
type RelationalRuntimeForKey<
  TSchema extends SchemaMap,
  TTables extends TableMap,
  TDefinitions extends DefinitionMap<TTables>,
  TKey extends keyof TTables,
> = RelationalRuntimeFactory<
  TTables[TKey],
  TKey extends keyof TDefinitions ? DefinitionTransient<NonNullable<TDefinitions[TKey]>> : {},
  TSchema
>;
type KeyForTable<TTables extends TableMap, TTable extends TTables[keyof TTables]> = {
  [K in keyof TTables]-?: TTables[K] extends TTable ? K : never;
}[keyof TTables];
type RuntimeForTable<
  TTables extends TableMap,
  TDefinitions extends DefinitionMap<TTables>,
  TTable extends TTables[keyof TTables],
> = RuntimeForKey<TTables, TDefinitions, KeyForTable<TTables, TTable>>;
type RelationalRuntimeForTable<
  TSchema extends SchemaMap,
  TTables extends TableMap,
  TDefinitions extends DefinitionMap<TTables>,
  TTable extends TTables[keyof TTables],
> = RelationalRuntimeForKey<TSchema, TTables, TDefinitions, KeyForTable<TTables, TTable>>;

/**
 * Connected runtime entry for one table.
 *
 * This is what users interact with after calling `createFactories(...)`.
 */
export interface RuntimeFactory<
  TTable extends Table,
  TTransient extends Record<string, unknown> = {},
> extends FactoryDefinition<TTable, TTransient> {
  /**
   * Sets default values for this runtime entry.
   */
  defaults(overrides: FactoryOverrides<TTable>): RuntimeFactory<TTable, TTransient>;
  /**
   * Declares extra inputs that can be read from `context.transient`.
   */
  transient<TNextTransient extends FactoryTransient>(
    defaults: TNextTransient,
  ): RuntimeFactory<TTable, Simplify<TTransient & TNextTransient>>;
  /**
   * Adds custom value logic on top of the auto-generated base values.
   */
  state(input: FactoryStateInput<TTable, TTransient>): RuntimeFactory<TTable, TTransient>;
  /**
   * Registers a reusable named variant.
   */
  trait(
    name: string,
    definition: FactoryTraitDefinition<TTable, TTransient>,
  ): RuntimeFactory<TTable, TTransient>;
  /**
   * Applies one or more previously defined traits.
   */
  withTraits(...names: string[]): RuntimeFactory<TTable, TTransient>;
  /**
   * Adds a hook that runs after `build()`.
   */
  afterBuild(hook: FactoryBuildHook<TTable, TTransient>): RuntimeFactory<TTable, TTransient>;
  /**
   * Adds a hook that runs after `create()`.
   */
  afterCreate(hook: FactoryCreateHook<TTable, TTransient>): RuntimeFactory<TTable, TTransient>;
  /**
   * Builds one row and persists it through the configured runtime adapter.
   */
  create(
    overrides?: FactoryOverrides<TTable>,
    options?: FactoryCallOptions<TTransient>,
  ): Promise<InferSelectModel<TTable>>;
  /**
   * Builds, persists, and returns one nested graph rooted at this table.
   */
  createGraph(
    overrides?: FactoryOverrides<TTable>,
    options?: FactoryCallOptions<TTransient>,
  ): Promise<FactoryGraphNode<InferSelectModel<TTable>, {}>>;
  /**
   * Builds and persists many rows.
   */
  createList(
    count: number,
    overrides?: FactoryOverrides<TTable> | ((index: number) => FactoryOverrides<TTable>),
    options?: FactoryCallOptions<TTransient>,
  ): Promise<InferSelectModel<TTable>[]>;
  /**
   * Builds, persists, and returns many nested graphs rooted at this table.
   */
  createGraphList(
    count: number,
    overrides?: FactoryOverrides<TTable> | ((index: number) => FactoryOverrides<TTable>),
    options?: FactoryCallOptions<TTransient>,
  ): Promise<Array<FactoryGraphNode<InferSelectModel<TTable>, {}>>>;
}

/**
 * One persisted row plus nested related rows keyed by Drizzle relation name.
 */
export type RelationalFactoryGraphNode<
  TSchema extends SchemaMap,
  TTable extends Table,
> = FactoryGraphNode<InferSelectModel<TTable>, RelationGraphRelations<TSchema, TTable>>;

/**
 * Connected runtime entry with relation-aware chain helpers.
 *
 * This surface is available when `createFactories({ db, schema })` receives a
 * Drizzle schema object that also exports `relations(...)`.
 */
export interface RelationalRuntimeFactory<
  TTable extends Table,
  TTransient extends Record<string, unknown> = {},
  TSchema extends SchemaMap = {},
> extends RuntimeFactory<TTable, TTransient> {
  /**
   * Sets default values for this runtime entry.
   */
  defaults(
    overrides: FactoryOverrides<TTable>,
  ): RelationalRuntimeFactory<TTable, TTransient, TSchema>;
  /**
   * Declares extra inputs that can be read from `context.transient`.
   */
  transient<TNextTransient extends FactoryTransient>(
    defaults: TNextTransient,
  ): RelationalRuntimeFactory<TTable, Simplify<TTransient & TNextTransient>, TSchema>;
  /**
   * Adds custom value logic on top of the auto-generated base values.
   */
  state(
    input: FactoryStateInput<TTable, TTransient>,
  ): RelationalRuntimeFactory<TTable, TTransient, TSchema>;
  /**
   * Registers a reusable named variant.
   */
  trait(
    name: string,
    definition: FactoryTraitDefinition<TTable, TTransient>,
  ): RelationalRuntimeFactory<TTable, TTransient, TSchema>;
  /**
   * Applies one or more previously defined traits.
   */
  withTraits(...names: string[]): RelationalRuntimeFactory<TTable, TTransient, TSchema>;
  /**
   * Adds a hook that runs after `build()`.
   */
  afterBuild(
    hook: FactoryBuildHook<TTable, TTransient>,
  ): RelationalRuntimeFactory<TTable, TTransient, TSchema>;
  /**
   * Adds a hook that runs after `create()`.
   */
  afterCreate(
    hook: FactoryCreateHook<TTable, TTransient>,
  ): RelationalRuntimeFactory<TTable, TTransient, TSchema>;
  /**
   * Builds, persists, and returns one nested graph rooted at this table.
   */
  createGraph(
    overrides?: FactoryOverrides<TTable>,
    options?: FactoryCallOptions<TTransient>,
  ): Promise<RelationalFactoryGraphNode<TSchema, TTable>>;
  /**
   * Builds, persists, and returns many nested graphs rooted at this table.
   */
  createGraphList(
    count: number,
    overrides?: FactoryOverrides<TTable> | ((index: number) => FactoryOverrides<TTable>),
    options?: FactoryCallOptions<TTransient>,
  ): Promise<Array<RelationalFactoryGraphNode<TSchema, TTable>>>;
  /**
   * Plans a belongs-to relation for the next `create()` call.
   */
  for<TKey extends OneRelationKeys<TSchema, TTable>>(
    relation: TKey,
    input?:
      | FactoryOverrides<RelationTargetTable<TSchema, TTable, TKey>>
      | ExistingRow<RelationTargetTable<TSchema, TTable, TKey>>
      | FactoryDefinition<RelationTargetTable<TSchema, TTable, TKey>>,
  ): RelationalRuntimeFactory<TTable, TTransient, TSchema>;
  /**
   * Plans one child row for the next `create()` call.
   */
  hasOne<TKey extends OneRelationKeys<TSchema, TTable>>(
    relation: TKey,
    input?:
      | FactoryOverrides<RelationTargetTable<TSchema, TTable, TKey>>
      | FactoryDefinition<RelationTargetTable<TSchema, TTable, TKey>>,
  ): RelationalRuntimeFactory<TTable, TTransient, TSchema>;
  /**
   * Plans many child rows for the next `create()` call.
   */
  hasMany<TKey extends ManyRelationKeys<TSchema, TTable>>(
    relation: TKey,
    count?: number,
    input?:
      | FactoryOverrides<RelationTargetTable<TSchema, TTable, TKey>>
      | FactoryDefinition<RelationTargetTable<TSchema, TTable, TKey>>
      | ((index: number) => FactoryOverrides<RelationTargetTable<TSchema, TTable, TKey>>),
  ): RelationalRuntimeFactory<TTable, TTransient, TSchema>;
}

/**
 * Result returned by `lint()`.
 */
export interface FactoryLintIssue {
  /**
   * Registry key that failed.
   */
  key: string;
  /**
   * Runtime table name.
   */
  table: string;
  /**
   * Original error that occurred during build.
   */
  error: Error;
}

/**
 * Connected registry returned by `createFactories(...)` when only tables are supplied.
 */
export type FactoryRegistry<
  TTables extends TableMap,
  TDefinitions extends DefinitionMap<TTables> = {},
> = {
  [K in keyof TTables]: RuntimeForKey<TTables, TDefinitions, K>;
} & {
  /**
   * Looks up a runtime factory by registry key.
   */
  get<TKey extends keyof TTables>(key: TKey): RuntimeForKey<TTables, TDefinitions, TKey>;
  /**
   * Looks up a runtime factory by the table object.
   */
  get<TTable extends TTables[keyof TTables]>(
    table: TTable,
  ): RuntimeForTable<TTables, TDefinitions, TTable>;
  /**
   * Resets all sequences in the current registry.
   */
  resetSequences(next?: number): void;
  /**
   * Builds each registry entry once and returns any definition errors.
   */
  lint(): Promise<FactoryLintIssue[]>;
};

/**
 * Connected registry returned by `createFactories(...)` when a schema object is supplied.
 */
export type RelationalFactoryRegistry<
  TSchema extends SchemaMap,
  TTables extends TableMap = ExtractTables<TSchema>,
  TDefinitions extends DefinitionMap<TTables> = {},
> = {
  [K in keyof TTables]: RelationalRuntimeForKey<TSchema, TTables, TDefinitions, K>;
} & {
  /**
   * Looks up a runtime factory by registry key.
   */
  get<TKey extends keyof TTables>(
    key: TKey,
  ): RelationalRuntimeForKey<TSchema, TTables, TDefinitions, TKey>;
  /**
   * Looks up a runtime factory by the table object.
   */
  get<TTable extends TTables[keyof TTables]>(
    table: TTable,
  ): RelationalRuntimeForTable<TSchema, TTables, TDefinitions, TTable>;
  /**
   * Resets all sequences in the current registry.
   */
  resetSequences(next?: number): void;
  /**
   * Builds each registry entry once and returns any definition errors.
   */
  lint(): Promise<FactoryLintIssue[]>;
};

/**
 * Input accepted by `createFactories(...)`.
 *
 * `tables` is the canonical input. `schema` is a convenience alias for callers
 * who already export an object such as `import * as schema from "./schema"`.
 */
export interface CreateFactoriesTablesOptions<
  DB,
  TTables extends TableMap,
  TDefinitions extends DefinitionMap<TTables> = {},
> {
  /**
   * Connected Drizzle database used by `create()`.
   */
  db: DB;
  /**
   * Canonical table registry input.
   */
  tables: TTables;
  /**
   * Prevents mixing `tables` and `schema`.
   */
  schema?: never;
  /**
   * Optional reusable definitions keyed by the same registry keys as `tables`.
   */
  definitions?: TDefinitions;
  /**
   * Optional persistence adapter. By default Drizzle's `returning()` flow is used.
   */
  adapter?: FactoryAdapter<DB>;
}

/**
 * Input accepted by `createFactories(...)` when callers already export a Drizzle
 * schema object. Non-table exports such as enums are ignored automatically.
 */
export interface CreateFactoriesSchemaOptions<
  DB,
  TSchema extends SchemaMap,
  TTables extends TableMap = ExtractTables<TSchema>,
  TDefinitions extends DefinitionMap<TTables> = {},
> {
  /**
   * Connected Drizzle database used by `create()`.
   */
  db: DB;
  /**
   * Schema-like object that may include both tables and non-table exports.
   */
  schema: TSchema;
  /**
   * Prevents mixing `tables` and `schema`.
   */
  tables?: never;
  /**
   * Optional reusable definitions keyed by the extracted table names.
   */
  definitions?: TDefinitions;
  /**
   * Optional persistence adapter. By default Drizzle's `returning()` flow is used.
   */
  adapter?: FactoryAdapter<DB>;
}

export type CreateFactoriesOptions<
  DB,
  TTables extends TableMap,
  TDefinitions extends DefinitionMap<TTables> = {},
> =
  | CreateFactoriesTablesOptions<DB, TTables, TDefinitions>
  | CreateFactoriesSchemaOptions<DB, SchemaMap, TTables, TDefinitions>;

/**
 * Creates one connected runtime registry for a set of Drizzle tables.
 *
 * This is the primary entrypoint for the library. It owns database persistence,
 * dependency resolution, and connected `create()` calls.
 */
export function createFactories<
  DB,
  TTables extends TableMap,
  TDefinitions extends DefinitionMap<TTables> = {},
>(
  options: CreateFactoriesTablesOptions<DB, TTables, TDefinitions>,
): FactoryRegistry<TTables, TDefinitions>;
export function createFactories<
  DB,
  TSchema extends SchemaMap,
  TTables extends TableMap = ExtractTables<TSchema>,
  TDefinitions extends DefinitionMap<TTables> = {},
>(
  options: CreateFactoriesSchemaOptions<DB, TSchema, TTables, TDefinitions>,
): RelationalFactoryRegistry<TSchema, TTables, TDefinitions>;
export function createFactories(
  options:
    | CreateFactoriesTablesOptions<any, any, any>
    | CreateFactoriesSchemaOptions<any, any, any, any>,
): any {
  const normalized = normalizeInput(options);
  const definitions = normalizeDefinitions(normalized.tables, options.definitions);
  const binding: FactoryBinding<unknown> = {
    db: options.db,
    adapter: options.adapter ?? drizzleReturning<unknown>(),
  };
  const tableMap = new Map<Table, AutoFactory<Table, FactoryTransient>>();
  const runtimeBinding = {
    ...binding,
    registry: tableMap,
    relations: normalized.runtimeRelations,
  };
  const connected = {} as Record<string, AutoFactory<Table, FactoryTransient>>;

  for (const [key, definition] of Object.entries(definitions)) {
    connected[key] = definition.connect(runtimeBinding) as AutoFactory<Table, FactoryTransient>;
  }

  for (const [key, table] of Object.entries(normalized.tables)) {
    tableMap.set(table, connected[key]!);
  }

  return attachRegistryHelpers(connected, normalized.tables);
}

function normalizeInput(
  options:
    | CreateFactoriesTablesOptions<unknown, TableMap, DefinitionMap<TableMap>>
    | CreateFactoriesSchemaOptions<unknown, SchemaMap, TableMap, DefinitionMap<TableMap>>,
) {
  if ("tables" in options && options.tables) {
    return {
      runtimeRelations: undefined,
      tables: options.tables,
    };
  }

  const entries = Object.entries(options.schema).filter(([, value]) => isTable(value));

  if (entries.length === 0) {
    throw new Error('createFactories(...) could not find any Drizzle tables in "schema".');
  }

  return {
    runtimeRelations: extractRuntimeRelations(options.schema),
    tables: Object.fromEntries(entries) as TableMap,
  };
}

function normalizeDefinitions<TTables extends TableMap>(
  tables: TTables,
  definitions: DefinitionMap<TTables> | undefined,
) {
  const resolved = {} as Record<string, AutoFactory<Table, FactoryTransient>>;

  if (definitions) {
    for (const key of Object.keys(definitions)) {
      if (!(key in tables)) {
        throw new Error(`Unknown definition key "${key}". Add the matching table to "tables".`);
      }
    }
  }

  for (const [key, table] of Object.entries(tables)) {
    const definition = definitions?.[key as keyof TTables];
    resolved[key] = definition ? asAutoFactory(definition, key) : fromTable(table);
  }

  return resolved;
}

function attachRegistryHelpers<TTables extends TableMap>(
  registry: Record<string, AutoFactory<Table, FactoryTransient>>,
  tables: TTables,
) {
  Object.defineProperty(registry, "get", {
    enumerable: false,
    value(input: string | Table) {
      if (typeof input === "string") {
        const value = registry[input];

        if (!value) {
          throw new Error(`Unknown runtime factory "${input}".`);
        }

        return value;
      }

      for (const [key, table] of Object.entries(tables)) {
        if (table === input) {
          return registry[key]!;
        }
      }

      throw new Error(`Table "${tableNameOf(input)}" is not registered in this runtime.`);
    },
  });

  Object.defineProperty(registry, "resetSequences", {
    enumerable: false,
    value(next = 0) {
      for (const value of Object.values(registry)) {
        value.resetSequence(next);
      }
    },
  });

  Object.defineProperty(registry, "lint", {
    enumerable: false,
    async value() {
      const issues: FactoryLintIssue[] = [];

      for (const [key, value] of Object.entries(registry)) {
        try {
          await value.build();
        } catch (error) {
          const table = tables[key as keyof TTables];

          issues.push({
            error: normalizeError(error),
            key,
            table: table ? tableNameOf(table) : key,
          });
        }
      }

      return issues;
    },
  });

  return registry;
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function asAutoFactory(definition: AnyDefinition, key: string) {
  const candidate = definition as unknown as {
    [FACTORY_INSTANCE]?: unknown;
    connect?: unknown;
  };

  if (candidate[FACTORY_INSTANCE] !== true || typeof candidate.connect !== "function") {
    throw new Error(
      `Definition "${key}" was not created by kiri-factory. Pass a value returned by defineFactory(...).`,
    );
  }

  return definition as unknown as AutoFactory<Table, FactoryTransient>;
}
