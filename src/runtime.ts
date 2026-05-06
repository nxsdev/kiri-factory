import type { InferSelectModel, Table } from "drizzle-orm";

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
import type {
  FactoryAdapter,
  FactoryBinding,
  FactoryInferenceOptions,
  FactoryTraitRegistry,
  FactoryTraitsInput,
} from "./types";

type SchemaMap = Record<string, unknown>;
type TableMap = Record<string, Table>;
type ExtractTables<TSchema extends SchemaMap> = {
  [K in keyof TSchema as TSchema[K] extends Table ? K : never]: Extract<TSchema[K], Table>;
};
type DefinitionMap<TTables extends TableMap> = Partial<{
  [K in keyof TTables]: FactoryDefinition<TTables[K], FactoryTraitsInput<TTables[K]>>;
}>;
type TraitsOfDefinition<TDefinition, TTable extends Table> =
  TDefinition extends FactoryDefinition<TTable, infer TTraits> ? TTraits : {};
type RuntimeForKey<
  TSchema extends SchemaMap,
  TDefinitions extends DefinitionMap<ExtractTables<TSchema>>,
  TKey extends keyof ExtractTables<TSchema>,
> = RuntimeFactory<
  ExtractTables<TSchema>[TKey],
  TraitsOfDefinition<TDefinitions[TKey], ExtractTables<TSchema>[TKey]>
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
  TTraits extends FactoryTraitsInput<TTable> = {},
> extends FactoryDefinition<TTable, TTraits> {
  readonly traits: FactoryTraitRegistry<TTable, TTraits, RuntimeFactory<TTable, TTraits>>;
  create(overrides?: FactoryOverrides<TTable>): Promise<InferSelectModel<TTable>>;
  createMany(
    count: number,
    overrides?: FactoryOverrides<TTable> | ((index: number) => FactoryOverrides<TTable>),
  ): Promise<InferSelectModel<TTable>[]>;
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
  getSeed(): number;
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
  seed?: number;
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
    ...(options.seed === undefined ? {} : { seed: options.seed }),
  };
  const connected = connectRuntimeRegistry(
    binding,
    tables as TableMap,
    options.definitions as Record<
      string,
      FactoryDefinition<Table, FactoryTraitsInput<Table>> | undefined
    >,
    options.inference,
    extractRuntimeRelations(options.schema),
  );

  return attachRegistryHelpers(
    connected,
    tables as TableMap,
    binding.seed ?? 0,
  ) as unknown as FactoryRegistry<TSchema, TDefinitions>;
}

export type { FactoryLintIssue } from "./internal/runtime-registry";
