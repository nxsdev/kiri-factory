import type { AnyRelation, AnyRelations, InferSelectModel, Many, One, Table } from "drizzle-orm";

import type {
  ExistingRow,
  FactoryBuildHook,
  FactoryCallOptions,
  FactoryCreateHook,
  FactoryGraphNode,
  FactoryOverrides,
  FactoryStateInput,
  FactoryTraitDefinition,
} from "./core";
import type { FactoryDefinition } from "./define";
import { drizzleReturning } from "./drizzle";
import { tableNameOf } from "./rqb-v2-introspection";
import { extractRuntimeRelationsFromRqbV2 } from "./rqb-v2-relations";
import type { FactoryAdapter, FactoryBinding, FactoryInferenceOptions } from "./types";
import {
  attachRegistryHelpers,
  connectRuntimeRegistry,
} from "../../shared/src/internal/runtime-registry";

type RelationsMap = AnyRelations;
type TableMap = Record<string, Table>;
type FactoryTransient = Record<string, unknown>;
type DefinitionMap<TTables extends TableMap> = Partial<{
  [K in keyof TTables]: FactoryDefinition<TTables[K], FactoryTransient>;
}>;
type TablesFromRelations<TRelations extends RelationsMap> = {
  [K in keyof TRelations]: TRelations[K] extends { table: infer TTable extends Table }
    ? TTable
    : never;
};
type DefinitionTransient<TValue> =
  TValue extends FactoryDefinition<Table, infer TTransient> ? TTransient : {};
type RelationsForKey<
  TRelations extends RelationsMap,
  TKey extends keyof TRelations,
> = TRelations[TKey] extends { relations: infer TConfig extends Record<string, AnyRelation> }
  ? TConfig
  : {};
type RelationKeysOfKind<TRelations extends RelationsMap, TKey extends keyof TRelations, TKind> = {
  [K in keyof RelationsForKey<TRelations, TKey>]-?: RelationsForKey<
    TRelations,
    TKey
  >[K] extends TKind
    ? K
    : never;
}[keyof RelationsForKey<TRelations, TKey>] &
  string;
type OneRelationKeys<
  TRelations extends RelationsMap,
  TKey extends keyof TRelations,
> = RelationKeysOfKind<TRelations, TKey, One<any, any>>;
type ManyRelationKeys<
  TRelations extends RelationsMap,
  TKey extends keyof TRelations,
> = RelationKeysOfKind<TRelations, TKey, Many<any>>;
type RelationTargetKey<TRelations extends RelationsMap, TRelation extends AnyRelation> = Extract<
  keyof TRelations,
  TRelation["targetTableName"]
>;
type RelationTargetTable<
  TRelations extends RelationsMap,
  TKey extends keyof TRelations,
  TRelationKey extends keyof RelationsForKey<TRelations, TKey>,
> = TablesFromRelations<TRelations>[RelationTargetKey<
  TRelations,
  Extract<RelationsForKey<TRelations, TKey>[TRelationKey], AnyRelation>
>];
type RqbV2GraphValue<
  TRelations extends RelationsMap,
  TKey extends keyof TRelations,
  TRelationKey extends keyof RelationsForKey<TRelations, TKey>,
> =
  RelationsForKey<TRelations, TKey>[TRelationKey] extends Many<any>
    ? Array<
        RqbV2FactoryGraphNode<
          TRelations,
          RelationTargetKey<
            TRelations,
            Extract<RelationsForKey<TRelations, TKey>[TRelationKey], AnyRelation>
          >
        >
      >
    : RqbV2FactoryGraphNode<
        TRelations,
        RelationTargetKey<
          TRelations,
          Extract<RelationsForKey<TRelations, TKey>[TRelationKey], AnyRelation>
        >
      >;
type RqbV2GraphRelations<TRelations extends RelationsMap, TKey extends keyof TRelations> = Partial<{
  [K in keyof RelationsForKey<TRelations, TKey> & string]: RqbV2GraphValue<TRelations, TKey, K>;
}>;
type Simplify<T> = { [K in keyof T]: T[K] } & {};
type RuntimeForKey<
  TRelations extends RelationsMap,
  TDefinitions extends DefinitionMap<TablesFromRelations<TRelations>>,
  TKey extends keyof TablesFromRelations<TRelations>,
> = RqbV2RuntimeFactory<
  TablesFromRelations<TRelations>[TKey],
  TKey extends keyof TDefinitions ? DefinitionTransient<NonNullable<TDefinitions[TKey]>> : {},
  TRelations,
  TKey
>;

/**
 * Lint issue reported by `factories.lint()`.
 */
export interface FactoryLintIssue {
  key: string;
  table: string;
  error: Error;
}

/**
 * Connected runtime entry for one table.
 */
export interface RuntimeFactory<
  TTable extends Table,
  TTransient extends Record<string, unknown> = {},
> extends FactoryDefinition<TTable, TTransient> {
  defaults(overrides: FactoryOverrides<TTable>): RuntimeFactory<TTable, TTransient>;
  transient<TNextTransient extends FactoryTransient>(
    defaults: TNextTransient,
  ): RuntimeFactory<TTable, Simplify<TTransient & TNextTransient>>;
  state(input: FactoryStateInput<TTable, TTransient>): RuntimeFactory<TTable, TTransient>;
  trait(
    name: string,
    definition: FactoryTraitDefinition<TTable, TTransient>,
  ): RuntimeFactory<TTable, TTransient>;
  withTraits(...names: string[]): RuntimeFactory<TTable, TTransient>;
  afterBuild(hook: FactoryBuildHook<TTable, TTransient>): RuntimeFactory<TTable, TTransient>;
  afterCreate(hook: FactoryCreateHook<TTable, TTransient>): RuntimeFactory<TTable, TTransient>;
  create(
    overrides?: FactoryOverrides<TTable>,
    options?: FactoryCallOptions<TTransient>,
  ): Promise<InferSelectModel<TTable>>;
  createGraph(
    overrides?: FactoryOverrides<TTable>,
    options?: FactoryCallOptions<TTransient>,
  ): Promise<FactoryGraphNode<InferSelectModel<TTable>, {}>>;
  createList(
    count: number,
    overrides?: FactoryOverrides<TTable> | ((index: number) => FactoryOverrides<TTable>),
    options?: FactoryCallOptions<TTransient>,
  ): Promise<InferSelectModel<TTable>[]>;
  createGraphList(
    count: number,
    overrides?: FactoryOverrides<TTable> | ((index: number) => FactoryOverrides<TTable>),
    options?: FactoryCallOptions<TTransient>,
  ): Promise<Array<FactoryGraphNode<InferSelectModel<TTable>, {}>>>;
}

/**
 * One persisted row plus nested related rows keyed by RQB v2 relation name.
 */
export type RqbV2FactoryGraphNode<
  TRelations extends RelationsMap,
  TKey extends keyof TRelations,
> = FactoryGraphNode<
  InferSelectModel<TablesFromRelations<TRelations>[TKey]>,
  RqbV2GraphRelations<TRelations, TKey>
>;

/**
 * Connected runtime entry with RQB v2 relation-aware chain helpers.
 */
export interface RqbV2RuntimeFactory<
  TTable extends Table,
  TTransient extends Record<string, unknown> = {},
  TRelations extends RelationsMap = {},
  TKey extends keyof TRelations = never,
> extends RuntimeFactory<TTable, TTransient> {
  defaults(
    overrides: FactoryOverrides<TTable>,
  ): RqbV2RuntimeFactory<TTable, TTransient, TRelations, TKey>;
  transient<TNextTransient extends FactoryTransient>(
    defaults: TNextTransient,
  ): RqbV2RuntimeFactory<TTable, Simplify<TTransient & TNextTransient>, TRelations, TKey>;
  state(
    input: FactoryStateInput<TTable, TTransient>,
  ): RqbV2RuntimeFactory<TTable, TTransient, TRelations, TKey>;
  trait(
    name: string,
    definition: FactoryTraitDefinition<TTable, TTransient>,
  ): RqbV2RuntimeFactory<TTable, TTransient, TRelations, TKey>;
  withTraits(...names: string[]): RqbV2RuntimeFactory<TTable, TTransient, TRelations, TKey>;
  afterBuild(
    hook: FactoryBuildHook<TTable, TTransient>,
  ): RqbV2RuntimeFactory<TTable, TTransient, TRelations, TKey>;
  afterCreate(
    hook: FactoryCreateHook<TTable, TTransient>,
  ): RqbV2RuntimeFactory<TTable, TTransient, TRelations, TKey>;
  createGraph(
    overrides?: FactoryOverrides<TTable>,
    options?: FactoryCallOptions<TTransient>,
  ): Promise<RqbV2FactoryGraphNode<TRelations, TKey>>;
  createGraphList(
    count: number,
    overrides?: FactoryOverrides<TTable> | ((index: number) => FactoryOverrides<TTable>),
    options?: FactoryCallOptions<TTransient>,
  ): Promise<Array<RqbV2FactoryGraphNode<TRelations, TKey>>>;
  for<TRelationKey extends OneRelationKeys<TRelations, TKey>>(
    relation: TRelationKey,
    input?:
      | FactoryOverrides<RelationTargetTable<TRelations, TKey, TRelationKey>>
      | ExistingRow<RelationTargetTable<TRelations, TKey, TRelationKey>>
      | FactoryDefinition<RelationTargetTable<TRelations, TKey, TRelationKey>>,
  ): RqbV2RuntimeFactory<TTable, TTransient, TRelations, TKey>;
  hasOne<TRelationKey extends OneRelationKeys<TRelations, TKey>>(
    relation: TRelationKey,
    input?:
      | FactoryOverrides<RelationTargetTable<TRelations, TKey, TRelationKey>>
      | FactoryDefinition<RelationTargetTable<TRelations, TKey, TRelationKey>>,
  ): RqbV2RuntimeFactory<TTable, TTransient, TRelations, TKey>;
  hasMany<TRelationKey extends ManyRelationKeys<TRelations, TKey>>(
    relation: TRelationKey,
    count?: number,
    input?:
      | FactoryOverrides<RelationTargetTable<TRelations, TKey, TRelationKey>>
      | FactoryDefinition<RelationTargetTable<TRelations, TKey, TRelationKey>>
      | ((index: number) => FactoryOverrides<RelationTargetTable<TRelations, TKey, TRelationKey>>),
  ): RqbV2RuntimeFactory<TTable, TTransient, TRelations, TKey>;
}

/**
 * Connected registry returned by `createFactories(...)`.
 */
export type RqbV2FactoryRegistry<
  TRelations extends RelationsMap,
  TDefinitions extends DefinitionMap<TablesFromRelations<TRelations>> = {},
> = {
  [K in keyof TablesFromRelations<TRelations>]: RuntimeForKey<TRelations, TDefinitions, K>;
} & {
  get<TKey extends keyof TablesFromRelations<TRelations>>(
    key: TKey,
  ): RuntimeForKey<TRelations, TDefinitions, TKey>;
  get<TTable extends TablesFromRelations<TRelations>[keyof TablesFromRelations<TRelations>]>(
    table: TTable,
  ): RuntimeForKey<
    TRelations,
    TDefinitions,
    Extract<
      {
        [K in keyof TablesFromRelations<TRelations>]-?: TablesFromRelations<TRelations>[K] extends TTable
          ? K
          : never;
      }[keyof TablesFromRelations<TRelations>],
      keyof TablesFromRelations<TRelations>
    >
  >;
  resetSequences(next?: number): void;
  lint(): Promise<FactoryLintIssue[]>;
};

/**
 * Input accepted by `createFactories(...)` for RQB v2.
 */
export interface CreateFactoriesRqbV2Options<
  DB,
  TRelations extends RelationsMap,
  TDefinitions extends DefinitionMap<TablesFromRelations<TRelations>> = {},
> {
  db: DB;
  relations: TRelations;
  definitions?: TDefinitions;
  adapter?: FactoryAdapter<DB>;
  inference?: FactoryInferenceOptions<Table>;
}

/**
 * Creates one connected runtime registry for a Drizzle RQB v2 relation object.
 */
export function createFactories<
  DB,
  TRelations extends RelationsMap,
  TDefinitions extends DefinitionMap<TablesFromRelations<TRelations>> = {},
>(
  options: CreateFactoriesRqbV2Options<DB, TRelations, TDefinitions>,
): RqbV2FactoryRegistry<TRelations, TDefinitions> {
  const runtimeRelations = extractRuntimeRelationsFromRqbV2(options.relations);
  const tables = collectTables(options.relations, runtimeRelations);
  const binding: FactoryBinding<unknown> = {
    db: options.db,
    adapter: options.adapter ?? drizzleReturning<unknown>(),
  };
  const connected = connectRuntimeRegistry(
    binding as Parameters<typeof connectRuntimeRegistry>[0],
    tables as unknown as Parameters<typeof connectRuntimeRegistry>[1],
    options.definitions as unknown as Parameters<typeof connectRuntimeRegistry>[2],
    options.inference as unknown as Parameters<typeof connectRuntimeRegistry>[3],
    runtimeRelations as Parameters<typeof connectRuntimeRegistry>[4],
  );

  return attachRegistryHelpers(
    connected,
    tables as unknown as Parameters<typeof attachRegistryHelpers>[1],
  ) as unknown as RqbV2FactoryRegistry<TRelations, TDefinitions>;
}

function collectTables(
  relations: RelationsMap,
  runtimeRelations: ReturnType<typeof extractRuntimeRelationsFromRqbV2>,
) {
  const tables: TableMap = {};

  for (const [key, value] of Object.entries(relations)) {
    if (value && typeof value === "object" && "table" in value && value.table) {
      tables[key] = value.table as Table;
    }
  }

  for (const sourceRelations of runtimeRelations?.bySourceTable.values() ?? []) {
    for (const relation of sourceRelations.values()) {
      registerTableCandidate(tables, relation.sourceTable);
      registerTableCandidate(tables, relation.targetTable);

      if (relation.through) {
        registerTableCandidate(tables, relation.through.table);
      }
    }
  }

  return tables;
}

function registerTableCandidate(tables: TableMap, table: Table) {
  const exactKey = Object.entries(tables).find(([, value]) => value === table)?.[0];

  if (exactKey) {
    return;
  }

  const baseKey = tableNameOf(table);
  let key = baseKey;
  let suffix = 1;

  while (key in tables && tables[key] !== table) {
    suffix += 1;
    key = `${baseKey}_${suffix}`;
  }

  tables[key] = table;
}
