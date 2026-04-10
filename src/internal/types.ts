import type { getGeneratorsFunctions } from "drizzle-seed";
import type { Column, InferInsertModel, InferSelectModel, Table } from "drizzle-orm";

/**
 * Persists rows built by a factory.
 *
 * Most users can rely on the default Drizzle adapter that powers
 * `createFactories({ db, ... })`. A custom adapter is only needed when
 * `create()` should write through a different persistence strategy.
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
 *
 * Resolvers can inspect both Drizzle runtime metadata and the current sequence
 * number to provide values for columns that the built-in inference cannot fully
 * understand.
 */
export interface FactoryInferenceContext<TTable extends Table = Table> {
  /**
   * Drizzle table being inferred.
   */
  table: TTable;
  /**
   * Runtime table name, including any schema-qualified naming already resolved
   * by Drizzle.
   */
  tableName: string;
  /**
   * Drizzle column instance for the current field.
   */
  column: Column;
  /**
   * Property key used by the table object.
   */
  columnKey: string;
  /**
   * Monotonic sequence number for the current row.
   */
  sequence: number;
  /**
   * SQL type reported by `column.getSQLType()`.
   */
  sqlType: string;
  /**
   * Drizzle runtime data type tag, such as `string`, `number`, or `custom`.
   */
  dataType?: string;
  /**
   * Dialect-specific Drizzle column kind, such as `PgUUID` or `PgCustomColumn`.
   */
  columnType?: string;
}

/**
 * Value resolver used by schema inference hooks.
 *
 * Returning `undefined` tells kiri-factory to continue with the normal
 * inference pipeline.
 */
export type FactoryInferenceResolver<TTable extends Table = Table> = (
  context: FactoryInferenceContext<TTable>,
) => unknown;

/**
 * Advanced inference controls for schema-driven factories.
 */
export interface FactoryInferenceOptions<TTable extends Table = Table> {
  /**
   * Enables best-effort parsing of simple single-column `CHECK` constraints.
   *
   * Supported forms intentionally stay narrow:
   * `>`, `>=`, `<`, `<=`, `BETWEEN`, and `IN (...)` on one column.
   *
   * Complex SQL expressions still need `state(...)`, overrides, or custom
   * resolvers.
   *
   * @default true
   */
  checks?: boolean;
  /**
   * Column-specific resolvers keyed by either `columnKey` or
   * `tableName.columnKey`.
   *
   * These run before built-in heuristics and before custom-type resolvers.
   */
  columns?: Record<string, FactoryInferenceResolver<TTable>>;
  /**
   * Resolvers for `customType(...)` columns keyed by SQL type.
   *
   * kiri-factory first tries the exact `column.getSQLType()` result, then a
   * normalized base form without `(…)`, and finally the Drizzle `columnType`.
   *
   * Example keys:
   * - `vector(1536)`
   * - `vector`
   * - `bytea`
   * - `PgCustomColumn`
   */
  customTypes?: Record<string, FactoryInferenceResolver<TTable>>;
}

/**
 * Public drizzle-seed generator functions.
 *
 * This matches the callback argument used by `seed(...).refine((f) => ...)`.
 */
export type FactorySeedFunctions = ReturnType<typeof getGeneratorsFunctions>;

/**
 * Public drizzle-seed generator union returned from `f.*(...)`.
 */
export type FactorySeedGenerator = ReturnType<FactorySeedFunctions[keyof FactorySeedFunctions]>;

/**
 * Explicit drizzle-seed column generators shared by runtime factories and
 * `seed(...).refine((f) => ...)`.
 */
export type FactorySeedColumns<TTable extends Table> = Partial<
  Record<keyof InferInsertModel<TTable>, FactorySeedGenerator>
>;

/**
 * Shared drizzle-seed column definition callback.
 *
 * This uses the same `f` callback object that Drizzle's official
 * `seed(...).refine((f) => ...)` API exposes.
 */
export type FactorySeedColumnsInput<TTable extends Table> = (
  f: FactorySeedFunctions,
) => FactorySeedColumns<TTable>;
