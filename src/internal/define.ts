import type { Table } from "drizzle-orm";

import { FACTORY_INSTANCE, fromTable, type FactoryOverrides } from "./core";
import type {
  FactoryInferenceOptions,
  FactorySeedColumns,
  FactorySeedColumnsInput,
  FactorySeedFunctions,
} from "./types";

/**
 * Pure factory definition used to declare reusable behavior for one table.
 *
 * A definition can build rows in memory, but it does not own database
 * connectivity. Use `createFactories(...)` to execute `create()` against a DB.
 */
export interface FactoryDefinition<TTable extends Table> {
  readonly [FACTORY_INSTANCE]: true;
  /**
   * Returns the shared drizzle-seed column generators for this definition.
   *
   * The callback argument matches the official `seed(...).refine((f) => ...)`
   * API from `drizzle-seed`.
   */
  columns(f: FactorySeedFunctions): FactorySeedColumns<TTable>;
  /**
   * Resets the sequence used by auto-generated values.
   */
  resetSequence(next?: number): void;
  /**
   * Builds one row in memory.
   */
  build(
    overrides?: FactoryOverrides<TTable>,
  ): Promise<import("drizzle-orm").InferInsertModel<TTable>>;
  /**
   * Builds many rows in memory.
   */
  buildMany(
    count: number,
    overrides?: FactoryOverrides<TTable> | ((index: number) => FactoryOverrides<TTable>),
  ): Promise<import("drizzle-orm").InferInsertModel<TTable>[]>;
}

/**
 * Declarative configuration for `defineFactory(...)`.
 */
export interface DefineFactoryOptions<TTable extends Table> {
  /**
   * Primary shared definition surface used by both runtime factories and
   * `seed(...).refine((f) => ...)`.
   *
   * `columns` can mix fixed literals with official drizzle-seed generators.
   */
  columns?: FactorySeedColumnsInput<TTable>;
  /**
   * Advanced schema inference controls for this table.
   */
  inference?: FactoryInferenceOptions<TTable>;
}

/**
 * Creates a reusable definition for one table.
 *
 * Use this when a project wants shared factory modules instead of defining
 * everything inline at the runtime call site.
 */
export function defineFactory<TTable extends Table>(table: TTable): FactoryDefinition<TTable>;
export function defineFactory<TTable extends Table>(
  table: TTable,
  options: DefineFactoryOptions<TTable>,
): FactoryDefinition<TTable>;
export function defineFactory<TTable extends Table>(
  table: TTable,
  options: DefineFactoryOptions<TTable> = {},
): FactoryDefinition<TTable> {
  return fromTable(table, {
    ...(options.columns ? { columns: options.columns } : {}),
    ...(options.inference ? { inference: options.inference } : {}),
  }) as FactoryDefinition<TTable>;
}
