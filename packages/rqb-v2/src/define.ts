import type { Table } from "drizzle-orm";

import { defineFactory as defineFactoryRoot } from "../../../src/internal/define";

import type {
  FactoryBuildHook,
  FactoryCallOptions,
  FactoryCreateHook,
  FactoryOverrides,
  FactoryStateInput,
  FactoryTraitDefinition,
} from "./core";
import type {
  FactoryInferenceOptions,
  FactorySeedColumns,
  FactorySeedColumnsInput,
  FactorySeedFunctions,
} from "./types";

type FactoryTransient = Record<string, unknown>;
type Hook<T> = T | T[];

/**
 * Pure factory definition used to declare reusable behavior for one table.
 */
export interface FactoryDefinition<TTable extends Table, TTransient extends FactoryTransient = {}> {
  columns(f: FactorySeedFunctions): FactorySeedColumns<TTable>;
  defaults(overrides: FactoryOverrides<TTable>): FactoryDefinition<TTable, TTransient>;
  transient<TNextTransient extends FactoryTransient>(
    defaults: TNextTransient,
  ): FactoryDefinition<TTable, TTransient & TNextTransient>;
  state(input: FactoryStateInput<TTable, TTransient>): FactoryDefinition<TTable, TTransient>;
  trait(
    name: string,
    definition: FactoryTraitDefinition<TTable, TTransient>,
  ): FactoryDefinition<TTable, TTransient>;
  withTraits(...names: string[]): FactoryDefinition<TTable, TTransient>;
  afterBuild(hook: FactoryBuildHook<TTable, TTransient>): FactoryDefinition<TTable, TTransient>;
  afterCreate(hook: FactoryCreateHook<TTable, TTransient>): FactoryDefinition<TTable, TTransient>;
  resetSequence(next?: number): void;
  build(
    overrides?: FactoryOverrides<TTable>,
    options?: FactoryCallOptions<TTransient>,
  ): Promise<import("drizzle-orm").InferInsertModel<TTable>>;
  buildMany(
    count: number,
    overrides?: FactoryOverrides<TTable> | ((index: number) => FactoryOverrides<TTable>),
    options?: FactoryCallOptions<TTransient>,
  ): Promise<import("drizzle-orm").InferInsertModel<TTable>[]>;
}

/**
 * Declarative configuration for `defineFactory(...)`.
 */
export interface DefineFactoryOptions<
  TTable extends Table,
  TTransient extends FactoryTransient = {},
> {
  columns?: FactorySeedColumnsInput<TTable>;
  inference?: FactoryInferenceOptions<TTable>;
  transient?: TTransient;
  defaults?: FactoryOverrides<TTable>;
  state?: FactoryStateInput<TTable, TTransient>;
  traits?: Record<string, FactoryTraitDefinition<TTable, TTransient>>;
  afterBuild?: Hook<FactoryBuildHook<TTable, TTransient>>;
  afterCreate?: Hook<FactoryCreateHook<TTable, TTransient>>;
}

/**
 * Creates a reusable definition for one table.
 */
export function defineFactory<TTable extends Table>(table: TTable): FactoryDefinition<TTable>;
export function defineFactory<TTable extends Table, TTransient extends FactoryTransient = {}>(
  table: TTable,
  options: DefineFactoryOptions<TTable, TTransient>,
): FactoryDefinition<TTable, TTransient>;
export function defineFactory<TTable extends Table, TTransient extends FactoryTransient = {}>(
  table: TTable,
  options: DefineFactoryOptions<TTable, TTransient> = {},
): FactoryDefinition<TTable, TTransient> {
  return (
    defineFactoryRoot as unknown as <
      TWrappedTable extends Table,
      TWrappedTransient extends FactoryTransient = {},
    >(
      wrappedTable: TWrappedTable,
      wrappedOptions?: DefineFactoryOptions<TWrappedTable, TWrappedTransient>,
    ) => FactoryDefinition<TWrappedTable, TWrappedTransient>
  )(table, options);
}
