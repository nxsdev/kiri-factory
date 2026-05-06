import type { getGeneratorsFunctions } from "drizzle-seed";
import type { Column, InferInsertModel, InferSelectModel, Table } from "drizzle-orm";

/**
 * Persists rows built by a factory.
 */
export interface FactoryAdapter<DB = unknown> {
  create<TTable extends Table>(args: {
    db: DB;
    table: TTable;
    values: InferInsertModel<TTable>;
  }): Promise<InferSelectModel<TTable>>;
}

/**
 * A database plus the adapter used by `create()`.
 */
export interface FactoryBinding<DB = unknown> {
  db: DB;
  adapter: FactoryAdapter<DB>;
  seed?: number;
}

/**
 * Context passed to schema inference resolvers.
 */
export interface FactoryInferenceContext<TTable extends Table = Table> {
  table: TTable;
  tableName: string;
  column: Column;
  columnKey: string;
  sequence: number;
  sqlType: string;
  dataType?: string;
  columnType?: string;
}

/**
 * Value resolver used by schema inference hooks.
 */
export type FactoryInferenceResolver<TTable extends Table = Table> = (
  context: FactoryInferenceContext<TTable>,
) => unknown;

/**
 * Advanced inference controls for schema-driven factories.
 */
export interface FactoryInferenceOptions<TTable extends Table = Table> {
  checks?: boolean;
  columns?: Record<string, FactoryInferenceResolver<TTable>>;
  customTypes?: Record<string, FactoryInferenceResolver<TTable>>;
}

export type FactorySeedFunctions = ReturnType<typeof getGeneratorsFunctions>;

export type FactorySeedGenerator = ReturnType<FactorySeedFunctions[keyof FactorySeedFunctions]>;

export type FactoryColumnValue<TTable extends Table, TKey extends keyof InferInsertModel<TTable>> =
  | FactorySeedGenerator
  | InferInsertModel<TTable>[TKey];

export type FactoryColumnsDefinition<TTable extends Table> = Partial<{
  [K in keyof InferInsertModel<TTable>]: FactoryColumnValue<TTable, K>;
}>;

export type FactorySeedColumns<TTable extends Table> = Partial<
  Record<keyof InferInsertModel<TTable>, FactorySeedGenerator>
>;

export type FactorySeedColumnsInput<TTable extends Table> =
  | FactoryColumnsDefinition<TTable>
  | ((f: FactorySeedFunctions) => FactoryColumnsDefinition<TTable>);

export type FactoryTraitInput<TTable extends Table> = FactorySeedColumnsInput<TTable>;

export type FactoryTraitsInput<TTable extends Table> = Record<string, FactoryTraitInput<TTable>>;

export type FactoryTraitRegistry<
  TTable extends Table,
  TTraits extends FactoryTraitsInput<TTable>,
  TFactory,
> = {
  readonly [K in keyof TTraits]: TFactory;
};
