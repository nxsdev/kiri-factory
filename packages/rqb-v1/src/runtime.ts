import type {
  ExtractTableRelationsFromSchema,
  InferSelectModel,
  Many,
  One,
  Table,
} from "drizzle-orm";

import {
  type ExistingRow,
  type FactoryGraphNode,
  type FactoryBuildHook,
  type FactoryCallOptions,
  type FactoryCreateHook,
  type FactoryOverrides,
  type FactoryStateInput,
  type FactoryTraitDefinition,
} from "./core";
import type { ManyToManyBridge } from "./bridges";
import { type FactoryDefinition } from "./define";
import { drizzleReturning } from "./drizzle";
import { extractBridgeRuntimeRelations, mergeRuntimeRelations } from "./internal/bridge-relations";
import { isTable } from "./internal/drizzle-introspection";
import { extractRuntimeRelations } from "./internal/drizzle-relations";
import {
  attachRegistryHelpers,
  connectRuntimeRegistry,
  type FactoryLintIssue,
} from "./internal/runtime-registry";
import type { FactoryAdapter, FactoryBinding, FactoryInferenceOptions } from "./types";

type SchemaMap = Record<string, unknown>;
type TableMap = Record<string, Table>;
type FactoryTransient = Record<string, unknown>;
type DefinitionMap<TTables extends TableMap> = Partial<{
  [K in keyof TTables]: FactoryDefinition<TTables[K], FactoryTransient>;
}>;
type ExtractTables<TSchema extends SchemaMap> = {
  [K in keyof TSchema as TSchema[K] extends Table ? K : never]: Extract<TSchema[K], Table>;
};
type DefinitionTransient<TValue> =
  TValue extends FactoryDefinition<Table, infer TTransient> ? TTransient : {};
type BridgeMapForSchema<TSchema extends SchemaMap> = Partial<{
  [K in keyof ExtractTables<TSchema>]: Record<
    string,
    ManyToManyBridge<ExtractTables<TSchema>[keyof ExtractTables<TSchema>], string, string>
  >;
}>;
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
type SchemaKeyForTable<TSchema extends SchemaMap, TTable extends Table> = {
  [K in keyof ExtractTables<TSchema>]-?: ExtractTables<TSchema>[K] extends TTable ? K : never;
}[keyof ExtractTables<TSchema>];
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
type BridgeDefinitionsForTable<
  TSchema extends SchemaMap,
  TBridges extends BridgeMapForSchema<TSchema>,
  TTable extends Table,
> =
  SchemaKeyForTable<TSchema, TTable> extends infer TKey
    ? TKey extends keyof TBridges
      ? NonNullable<TBridges[TKey]>
      : {}
    : {};
type BridgeRelationKeys<
  TSchema extends SchemaMap,
  TBridges extends BridgeMapForSchema<TSchema>,
  TTable extends Table,
> = keyof BridgeDefinitionsForTable<TSchema, TBridges, TTable> & string;
type RelationTargetTable<
  TSchema extends SchemaMap,
  TTable extends Table,
  TKey extends keyof SchemaRelationsForTable<TSchema, TTable>,
> = SchemaTableByDbName<
  TSchema,
  NonNullable<SchemaRelationsForTable<TSchema, TTable>[TKey]>["referencedTableName"]
>;
type BridgeTargetTable<
  TSchema extends SchemaMap,
  TBridges extends BridgeMapForSchema<TSchema>,
  TTable extends Table,
  TKey extends BridgeRelationKeys<TSchema, TBridges, TTable>,
> =
  BridgeDefinitionsForTable<TSchema, TBridges, TTable>[TKey] extends ManyToManyBridge<
    infer TThrough,
    string,
    infer TTarget
  >
    ? TTarget extends keyof SchemaRelationsForTable<TSchema, TThrough>
      ? RelationTargetTable<TSchema, TThrough, TTarget>
      : never
    : never;
type SupportedManyRelationKeys<
  TSchema extends SchemaMap,
  TBridges extends BridgeMapForSchema<TSchema>,
  TTable extends Table,
> = ManyRelationKeys<TSchema, TTable> | BridgeRelationKeys<TSchema, TBridges, TTable>;
type SupportedManyRelationTargetTable<
  TSchema extends SchemaMap,
  TBridges extends BridgeMapForSchema<TSchema>,
  TTable extends Table,
  TKey extends SupportedManyRelationKeys<TSchema, TBridges, TTable>,
> =
  TKey extends ManyRelationKeys<TSchema, TTable>
    ? RelationTargetTable<TSchema, TTable, TKey>
    : TKey extends BridgeRelationKeys<TSchema, TBridges, TTable>
      ? BridgeTargetTable<TSchema, TBridges, TTable, TKey>
      : never;
type RelationGraphValue<
  TSchema extends SchemaMap,
  TBridges extends BridgeMapForSchema<TSchema>,
  TTable extends Table,
  TKey extends
    | (keyof SchemaRelationsForTable<TSchema, TTable> & string)
    | BridgeRelationKeys<TSchema, TBridges, TTable>,
> = TKey extends keyof SchemaRelationsForTable<TSchema, TTable> & string
  ? SchemaRelationsForTable<TSchema, TTable>[TKey] extends Many<any>
    ? Array<
        RelationalFactoryGraphNode<TSchema, RelationTargetTable<TSchema, TTable, TKey>, TBridges>
      >
    : RelationalFactoryGraphNode<TSchema, RelationTargetTable<TSchema, TTable, TKey>, TBridges>
  : TKey extends BridgeRelationKeys<TSchema, TBridges, TTable>
    ? Array<
        RelationalFactoryGraphNode<
          TSchema,
          BridgeTargetTable<TSchema, TBridges, TTable, TKey>,
          TBridges
        >
      >
    : never;
type RelationGraphRelations<
  TSchema extends SchemaMap,
  TTable extends Table,
  TBridges extends BridgeMapForSchema<TSchema>,
> = Partial<{
  [K in
    | (keyof SchemaRelationsForTable<TSchema, TTable> & string)
    | BridgeRelationKeys<TSchema, TBridges, TTable>]: RelationGraphValue<
    TSchema,
    TBridges,
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
  TBridges extends BridgeMapForSchema<TSchema>,
  TKey extends keyof TTables,
> = RelationalRuntimeFactory<
  TTables[TKey],
  TKey extends keyof TDefinitions ? DefinitionTransient<NonNullable<TDefinitions[TKey]>> : {},
  TSchema,
  TBridges
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
  TBridges extends BridgeMapForSchema<TSchema>,
  TTable extends TTables[keyof TTables],
> = RelationalRuntimeForKey<TSchema, TTables, TDefinitions, TBridges, KeyForTable<TTables, TTable>>;

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
  TBridges extends BridgeMapForSchema<TSchema> = {},
> = FactoryGraphNode<InferSelectModel<TTable>, RelationGraphRelations<TSchema, TTable, TBridges>>;

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
  TBridges extends BridgeMapForSchema<TSchema> = {},
> extends RuntimeFactory<TTable, TTransient> {
  /**
   * Sets default values for this runtime entry.
   */
  defaults(
    overrides: FactoryOverrides<TTable>,
  ): RelationalRuntimeFactory<TTable, TTransient, TSchema, TBridges>;
  /**
   * Declares extra inputs that can be read from `context.transient`.
   */
  transient<TNextTransient extends FactoryTransient>(
    defaults: TNextTransient,
  ): RelationalRuntimeFactory<TTable, Simplify<TTransient & TNextTransient>, TSchema, TBridges>;
  /**
   * Adds custom value logic on top of the auto-generated base values.
   */
  state(
    input: FactoryStateInput<TTable, TTransient>,
  ): RelationalRuntimeFactory<TTable, TTransient, TSchema, TBridges>;
  /**
   * Registers a reusable named variant.
   */
  trait(
    name: string,
    definition: FactoryTraitDefinition<TTable, TTransient>,
  ): RelationalRuntimeFactory<TTable, TTransient, TSchema, TBridges>;
  /**
   * Applies one or more previously defined traits.
   */
  withTraits(...names: string[]): RelationalRuntimeFactory<TTable, TTransient, TSchema, TBridges>;
  /**
   * Adds a hook that runs after `build()`.
   */
  afterBuild(
    hook: FactoryBuildHook<TTable, TTransient>,
  ): RelationalRuntimeFactory<TTable, TTransient, TSchema, TBridges>;
  /**
   * Adds a hook that runs after `create()`.
   */
  afterCreate(
    hook: FactoryCreateHook<TTable, TTransient>,
  ): RelationalRuntimeFactory<TTable, TTransient, TSchema, TBridges>;
  /**
   * Builds, persists, and returns one nested graph rooted at this table.
   */
  createGraph(
    overrides?: FactoryOverrides<TTable>,
    options?: FactoryCallOptions<TTransient>,
  ): Promise<RelationalFactoryGraphNode<TSchema, TTable, TBridges>>;
  /**
   * Builds, persists, and returns many nested graphs rooted at this table.
   */
  createGraphList(
    count: number,
    overrides?: FactoryOverrides<TTable> | ((index: number) => FactoryOverrides<TTable>),
    options?: FactoryCallOptions<TTransient>,
  ): Promise<Array<RelationalFactoryGraphNode<TSchema, TTable, TBridges>>>;
  /**
   * Plans a belongs-to relation for the next `create()` call.
   */
  for<TKey extends OneRelationKeys<TSchema, TTable>>(
    relation: TKey,
    input?:
      | FactoryOverrides<RelationTargetTable<TSchema, TTable, TKey>>
      | ExistingRow<RelationTargetTable<TSchema, TTable, TKey>>
      | FactoryDefinition<RelationTargetTable<TSchema, TTable, TKey>>,
  ): RelationalRuntimeFactory<TTable, TTransient, TSchema, TBridges>;
  /**
   * Plans one child row for the next `create()` call.
   */
  hasOne<TKey extends OneRelationKeys<TSchema, TTable>>(
    relation: TKey,
    input?:
      | FactoryOverrides<RelationTargetTable<TSchema, TTable, TKey>>
      | FactoryDefinition<RelationTargetTable<TSchema, TTable, TKey>>,
  ): RelationalRuntimeFactory<TTable, TTransient, TSchema, TBridges>;
  /**
   * Plans many child rows for the next `create()` call.
   */
  hasMany<TKey extends SupportedManyRelationKeys<TSchema, TBridges, TTable>>(
    relation: TKey,
    count?: number,
    input?:
      | FactoryOverrides<SupportedManyRelationTargetTable<TSchema, TBridges, TTable, TKey>>
      | FactoryDefinition<SupportedManyRelationTargetTable<TSchema, TBridges, TTable, TKey>>
      | ((
          index: number,
        ) => FactoryOverrides<SupportedManyRelationTargetTable<TSchema, TBridges, TTable, TKey>>),
  ): RelationalRuntimeFactory<TTable, TTransient, TSchema, TBridges>;
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
  TBridges extends BridgeMapForSchema<TSchema> = {},
> = {
  [K in keyof TTables]: RelationalRuntimeForKey<TSchema, TTables, TDefinitions, TBridges, K>;
} & {
  /**
   * Looks up a runtime factory by registry key.
   */
  get<TKey extends keyof TTables>(
    key: TKey,
  ): RelationalRuntimeForKey<TSchema, TTables, TDefinitions, TBridges, TKey>;
  /**
   * Looks up a runtime factory by the table object.
   */
  get<TTable extends TTables[keyof TTables]>(
    table: TTable,
  ): RelationalRuntimeForTable<TSchema, TTables, TDefinitions, TBridges, TTable>;
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
  /**
   * Optional global schema inference controls.
   *
   * These are applied to auto-generated factories and act as a fallback for
   * explicit definitions created with `defineFactory(...)`.
   */
  inference?: FactoryInferenceOptions<Table>;
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
  TBridges extends BridgeMapForSchema<TSchema> = {},
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
   * Optional virtual many-to-many bridges for stable `relations(...)`.
   *
   * Use this when your stable Drizzle schema models many-to-many through a
   * junction table, but you want test code to call a direct relation key such
   * as `hasMany("groups")`.
   */
  bridges?: TBridges;
  /**
   * Optional persistence adapter. By default Drizzle's `returning()` flow is used.
   */
  adapter?: FactoryAdapter<DB>;
  /**
   * Optional global schema inference controls.
   *
   * These are applied to auto-generated factories and act as a fallback for
   * explicit definitions created with `defineFactory(...)`.
   */
  inference?: FactoryInferenceOptions<Table>;
}

export type CreateFactoriesOptions<
  DB,
  TTables extends TableMap,
  TDefinitions extends DefinitionMap<TTables> = {},
  TBridges extends BridgeMapForSchema<SchemaMap> = {},
> =
  | CreateFactoriesTablesOptions<DB, TTables, TDefinitions>
  | CreateFactoriesSchemaOptions<DB, SchemaMap, TTables, TDefinitions, TBridges>;

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
  TBridges extends BridgeMapForSchema<TSchema> = {},
>(
  options: CreateFactoriesSchemaOptions<DB, TSchema, TTables, TDefinitions, TBridges>,
): RelationalFactoryRegistry<TSchema, TTables, TDefinitions, TBridges>;
export function createFactories(
  options:
    | CreateFactoriesTablesOptions<any, any, any>
    | CreateFactoriesSchemaOptions<any, any, any, any, any>,
): any {
  const normalized = normalizeInput(options);
  const binding: FactoryBinding<unknown> = {
    db: options.db,
    adapter: options.adapter ?? drizzleReturning<unknown>(),
  };
  const connected = connectRuntimeRegistry(
    binding,
    normalized.tables,
    options.definitions as Record<string, FactoryDefinition<Table, FactoryTransient> | undefined>,
    options.inference,
    normalized.runtimeRelations,
  );

  return attachRegistryHelpers(connected, normalized.tables);
}

export type { FactoryLintIssue } from "./internal/runtime-registry";

function normalizeInput(
  options:
    | CreateFactoriesTablesOptions<unknown, TableMap, DefinitionMap<TableMap>>
    | CreateFactoriesSchemaOptions<
        unknown,
        SchemaMap,
        TableMap,
        DefinitionMap<TableMap>,
        BridgeMapForSchema<SchemaMap>
      >,
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

  const tables = Object.fromEntries(entries) as TableMap;
  const schemaRelations = extractRuntimeRelations(options.schema);
  const bridgeRelations = extractBridgeRuntimeRelations(tables, options.bridges, schemaRelations);

  return {
    runtimeRelations: mergeRuntimeRelations(schemaRelations, bridgeRelations),
    tables,
  };
}
