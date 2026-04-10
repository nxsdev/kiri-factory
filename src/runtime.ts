import type { ExtractTableRelationsFromSchema, InferSelectModel, One, Table } from "drizzle-orm";

import type {
  FactoryBuildHook,
  FactoryCallOptions,
  FactoryCreateHook,
  FactoryOverrides,
  FactoryStateInput,
  FactoryTraitDefinition,
} from "./core";
import type { FactoryDefinition } from "./define";
import { drizzleReturning } from "./drizzle";
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
type ExtractTables<TSchema extends SchemaMap> = {
  [K in keyof TSchema as TSchema[K] extends Table ? K : never]: Extract<TSchema[K], Table>;
};
type DefinitionMap<TTables extends TableMap> = Partial<{
  [K in keyof TTables]: FactoryDefinition<TTables[K], FactoryTransient>;
}>;
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
type RelationTargetTable<
  TSchema extends SchemaMap,
  TTable extends Table,
  TKey extends keyof SchemaRelationsForTable<TSchema, TTable>,
> = SchemaTableByDbName<
  TSchema,
  NonNullable<SchemaRelationsForTable<TSchema, TTable>[TKey]>["referencedTableName"]
>;
type Simplify<T> = { [K in keyof T]: T[K] } & {};
type RuntimeForKey<
  TSchema extends SchemaMap,
  TDefinitions extends DefinitionMap<ExtractTables<TSchema>>,
  TKey extends keyof ExtractTables<TSchema>,
> = RuntimeFactory<
  ExtractTables<TSchema>[TKey],
  TKey extends keyof TDefinitions ? DefinitionTransient<NonNullable<TDefinitions[TKey]>> : {},
  TSchema
>;
type RuntimeForTable<
  TSchema extends SchemaMap,
  TDefinitions extends DefinitionMap<ExtractTables<TSchema>>,
  TTable extends ExtractTables<TSchema>[keyof ExtractTables<TSchema>],
> = RuntimeForKey<
  TSchema,
  TDefinitions,
  Extract<
    {
      [K in keyof ExtractTables<TSchema>]-?: ExtractTables<TSchema>[K] extends TTable ? K : never;
    }[keyof ExtractTables<TSchema>],
    keyof ExtractTables<TSchema>
  >
>;

export interface RuntimeFactory<
  TTable extends Table,
  TTransient extends Record<string, unknown> = {},
  TSchema extends SchemaMap = {},
> extends FactoryDefinition<TTable, TTransient> {
  defaults(overrides: FactoryOverrides<TTable>): RuntimeFactory<TTable, TTransient, TSchema>;
  transient<TNextTransient extends FactoryTransient>(
    defaults: TNextTransient,
  ): RuntimeFactory<TTable, Simplify<TTransient & TNextTransient>, TSchema>;
  state(input: FactoryStateInput<TTable, TTransient>): RuntimeFactory<TTable, TTransient, TSchema>;
  trait(
    name: string,
    definition: FactoryTraitDefinition<TTable, TTransient>,
  ): RuntimeFactory<TTable, TTransient, TSchema>;
  withTraits(...names: string[]): RuntimeFactory<TTable, TTransient, TSchema>;
  afterBuild(
    hook: FactoryBuildHook<TTable, TTransient>,
  ): RuntimeFactory<TTable, TTransient, TSchema>;
  afterCreate(
    hook: FactoryCreateHook<TTable, TTransient>,
  ): RuntimeFactory<TTable, TTransient, TSchema>;
  create(
    overrides?: FactoryOverrides<TTable>,
    options?: FactoryCallOptions<TTransient>,
  ): Promise<InferSelectModel<TTable>>;
  createMany(
    count: number,
    overrides?: FactoryOverrides<TTable> | ((index: number) => FactoryOverrides<TTable>),
    options?: FactoryCallOptions<TTransient>,
  ): Promise<InferSelectModel<TTable>[]>;
  buildMany(
    count: number,
    overrides?: FactoryOverrides<TTable> | ((index: number) => FactoryOverrides<TTable>),
    options?: FactoryCallOptions<TTransient>,
  ): Promise<import("drizzle-orm").InferInsertModel<TTable>[]>;
  for<TKey extends OneRelationKeys<TSchema, TTable>>(
    relation: TKey,
    input?: InferSelectModel<RelationTargetTable<TSchema, TTable, TKey>>,
  ): RuntimeFactory<TTable, TTransient, TSchema>;
}

export type FactoryRegistry<
  TSchema extends SchemaMap,
  TDefinitions extends DefinitionMap<ExtractTables<TSchema>> = {},
> = {
  [K in keyof ExtractTables<TSchema>]: RuntimeForKey<TSchema, TDefinitions, K>;
} & {
  get<TKey extends keyof ExtractTables<TSchema>>(
    key: TKey,
  ): RuntimeForKey<TSchema, TDefinitions, TKey>;
  get<TTable extends ExtractTables<TSchema>[keyof ExtractTables<TSchema>]>(
    table: TTable,
  ): RuntimeForTable<TSchema, TDefinitions, TTable>;
  resetSequences(next?: number): void;
  lint(): Promise<FactoryLintIssue[]>;
  verifyCreates(): Promise<FactoryLintIssue[]>;
};

export interface CreateFactoriesOptions<
  DB,
  TSchema extends SchemaMap,
  TDefinitions extends DefinitionMap<ExtractTables<TSchema>> = {},
> {
  db: DB;
  schema: TSchema;
  definitions?: TDefinitions;
  adapter?: FactoryAdapter<DB>;
  inference?: FactoryInferenceOptions<Table>;
}

export function createFactories<
  DB,
  TSchema extends SchemaMap,
  TDefinitions extends DefinitionMap<ExtractTables<TSchema>> = {},
>(
  options: CreateFactoriesOptions<DB, TSchema, TDefinitions>,
): FactoryRegistry<TSchema, TDefinitions> {
  const entries = Object.entries(options.schema).filter(([, value]) => isTable(value));

  if (entries.length === 0) {
    throw new Error('createFactories(...) could not find any Drizzle tables in "schema".');
  }

  const tables = Object.fromEntries(entries) as ExtractTables<TSchema>;
  const binding: FactoryBinding<unknown> = {
    db: options.db,
    adapter: options.adapter ?? drizzleReturning<unknown>(),
  };
  const connected = connectRuntimeRegistry(
    binding,
    tables as TableMap,
    options.definitions as Record<string, FactoryDefinition<Table, FactoryTransient> | undefined>,
    options.inference,
    extractRuntimeRelations(options.schema),
  );

  return attachRegistryHelpers(connected, tables as TableMap) as unknown as FactoryRegistry<
    TSchema,
    TDefinitions
  >;
}

export type { FactoryLintIssue } from "./internal/runtime-registry";
