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
