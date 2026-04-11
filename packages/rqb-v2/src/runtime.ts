import type { AnyRelation, AnyRelations, InferSelectModel, One, Table } from "drizzle-orm";

import type { FactoryOverrides } from "./core";
import type { FactoryDefinition } from "./define";
import { drizzleReturning } from "./drizzle";
import { tableNameOf } from "./rqb-v2-introspection";
import { extractRuntimeRelationsFromRqbV2 } from "./rqb-v2-relations";
import type { FactoryAdapter, FactoryBinding, FactoryInferenceOptions } from "./types";
import {
  attachRegistryHelpers,
  connectRuntimeRegistry,
  type FactoryLintIssue,
} from "../../../src/internal/runtime-registry";

type RelationsMap = AnyRelations;
type TableMap = Record<string, Table>;
type DefinitionMap<TTables extends TableMap> = Partial<{
  [K in keyof TTables]: FactoryDefinition<TTables[K]>;
}>;
type TablesFromRelations<TRelations extends RelationsMap> = {
  [K in keyof TRelations]: TRelations[K] extends { table: infer TTable extends Table }
    ? TTable
    : never;
};
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
type RuntimeForKey<
  TRelations extends RelationsMap,
  TKey extends keyof TablesFromRelations<TRelations>,
> = RuntimeFactory<
  TablesFromRelations<TRelations>[TKey],
  TRelations,
  Extract<TKey, keyof TRelations>
>;

export interface RuntimeFactory<
  TTable extends Table,
  TRelations extends RelationsMap = {},
  TKey extends keyof TRelations = never,
> extends FactoryDefinition<TTable> {
  create(overrides?: FactoryOverrides<TTable>): Promise<InferSelectModel<TTable>>;
  createMany(
    count: number,
    overrides?: FactoryOverrides<TTable> | ((index: number) => FactoryOverrides<TTable>),
  ): Promise<InferSelectModel<TTable>[]>;
  for<TRelationKey extends OneRelationKeys<TRelations, TKey>>(
    relation: TRelationKey,
    input: InferSelectModel<RelationTargetTable<TRelations, TKey, TRelationKey>>,
  ): RuntimeFactory<TTable, TRelations, TKey>;
}

export type FactoryRegistry<TRelations extends RelationsMap> = {
  [K in keyof TablesFromRelations<TRelations>]: RuntimeForKey<TRelations, K>;
} & {
  get<TKey extends keyof TablesFromRelations<TRelations>>(
    key: TKey,
  ): RuntimeForKey<TRelations, TKey>;
  get<TTable extends TablesFromRelations<TRelations>[keyof TablesFromRelations<TRelations>]>(
    table: TTable,
  ): RuntimeForKey<
    TRelations,
    Extract<
      {
        [K in keyof TablesFromRelations<TRelations>]-?: TablesFromRelations<TRelations>[K] extends TTable
          ? K
          : never;
      }[keyof TablesFromRelations<TRelations>],
      keyof TablesFromRelations<TRelations>
    >
  >;
  getSeed(): number;
  resetSequences(next?: number): void;
  lint(): Promise<FactoryLintIssue[]>;
  verifyCreates(): Promise<FactoryLintIssue[]>;
};

export interface CreateFactoriesOptions<
  DB,
  TRelations extends RelationsMap,
  TDefinitions extends DefinitionMap<TablesFromRelations<TRelations>> = {},
> {
  db: DB;
  relations: TRelations;
  definitions?: TDefinitions;
  adapter?: FactoryAdapter<DB>;
  inference?: FactoryInferenceOptions<Table>;
  seed?: number;
}

export function createFactories<
  DB,
  TRelations extends RelationsMap,
  TDefinitions extends DefinitionMap<TablesFromRelations<TRelations>> = {},
>(options: CreateFactoriesOptions<DB, TRelations, TDefinitions>): FactoryRegistry<TRelations> {
  const runtimeRelations = extractRuntimeRelationsFromRqbV2(options.relations);
  const tables = collectTables(options.relations, runtimeRelations);
  const binding: FactoryBinding<unknown> = {
    db: options.db,
    adapter: options.adapter ?? drizzleReturning<unknown>(),
    ...(options.seed === undefined ? {} : { seed: options.seed }),
  };
  const connected = connectRqbV2Registry(
    binding,
    tables,
    options.definitions,
    options.inference,
    runtimeRelations,
  );

  return attachRqbV2RegistryHelpers(
    connected,
    tables,
    binding.seed ?? 0,
  ) as unknown as FactoryRegistry<TRelations>;
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

function connectRqbV2Registry(
  binding: FactoryBinding<unknown>,
  tables: TableMap,
  definitions: DefinitionMap<TableMap> | undefined,
  inference: FactoryInferenceOptions<Table> | undefined,
  runtimeRelations: ReturnType<typeof extractRuntimeRelationsFromRqbV2>,
) {
  return connectRuntimeRegistry(
    binding as unknown as Parameters<typeof connectRuntimeRegistry>[0],
    tables as unknown as Parameters<typeof connectRuntimeRegistry>[1],
    definitions as unknown as Parameters<typeof connectRuntimeRegistry>[2],
    inference as unknown as Parameters<typeof connectRuntimeRegistry>[3],
    runtimeRelations as unknown as Parameters<typeof connectRuntimeRegistry>[4],
  );
}

function attachRqbV2RegistryHelpers(
  registry: ReturnType<typeof connectRuntimeRegistry>,
  tables: TableMap,
  seed: number,
) {
  return attachRegistryHelpers(
    registry,
    tables as unknown as Parameters<typeof attachRegistryHelpers>[1],
    seed,
  );
}

export type { FactoryLintIssue } from "../../../src/internal/runtime-registry";
