import type { ExtractTableRelationsFromSchema, InferSelectModel, One, Table } from "drizzle-orm";

import type { FactoryOverrides } from "./core";
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
type ExtractTables<TSchema extends SchemaMap> = {
  [K in keyof TSchema as TSchema[K] extends Table ? K : never]: Extract<TSchema[K], Table>;
};
type DefinitionMap<TTables extends TableMap> = Partial<{
  [K in keyof TTables]: FactoryDefinition<TTables[K]>;
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
type RuntimeForKey<
  TSchema extends SchemaMap,
  TKey extends keyof ExtractTables<TSchema>,
> = RuntimeFactory<ExtractTables<TSchema>[TKey], TSchema>;
type RuntimeForTable<
  TSchema extends SchemaMap,
  TTable extends ExtractTables<TSchema>[keyof ExtractTables<TSchema>],
> = RuntimeForKey<
  TSchema,
  Extract<
    {
      [K in keyof ExtractTables<TSchema>]-?: ExtractTables<TSchema>[K] extends TTable ? K : never;
    }[keyof ExtractTables<TSchema>],
    keyof ExtractTables<TSchema>
  >
>;

export interface RuntimeFactory<
  TTable extends Table,
  TSchema extends SchemaMap = {},
> extends FactoryDefinition<TTable> {
  create(overrides?: FactoryOverrides<TTable>): Promise<InferSelectModel<TTable>>;
  createMany(
    count: number,
    overrides?: FactoryOverrides<TTable> | ((index: number) => FactoryOverrides<TTable>),
  ): Promise<InferSelectModel<TTable>[]>;
  for<TKey extends OneRelationKeys<TSchema, TTable>>(
    relation: TKey,
    input: InferSelectModel<RelationTargetTable<TSchema, TTable, TKey>>,
  ): RuntimeFactory<TTable, TSchema>;
}

export type FactoryRegistry<TSchema extends SchemaMap> = {
  [K in keyof ExtractTables<TSchema>]: RuntimeForKey<TSchema, K>;
} & {
  get<TKey extends keyof ExtractTables<TSchema>>(key: TKey): RuntimeForKey<TSchema, TKey>;
  get<TTable extends ExtractTables<TSchema>[keyof ExtractTables<TSchema>]>(
    table: TTable,
  ): RuntimeForTable<TSchema, TTable>;
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
>(options: CreateFactoriesOptions<DB, TSchema, TDefinitions>): FactoryRegistry<TSchema> {
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
    options.definitions as Record<string, FactoryDefinition<Table> | undefined>,
    options.inference,
    extractRuntimeRelations(options.schema),
  );

  return attachRegistryHelpers(
    connected,
    tables as TableMap,
  ) as unknown as FactoryRegistry<TSchema>;
}

export type { FactoryLintIssue } from "./internal/runtime-registry";
