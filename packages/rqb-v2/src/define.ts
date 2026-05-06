import type { Table } from "drizzle-orm";

import { defineFactory as defineFactoryRoot } from "../../../src/internal/define";

import type { FactoryOverrides } from "./core";
import type {
  FactoryInferenceOptions,
  FactorySeedColumns,
  FactorySeedColumnsInput,
  FactorySeedFunctions,
  FactoryTraitRegistry,
  FactoryTraitsInput,
} from "./types";

/**
 * Pure factory definition used to declare reusable behavior for one table.
 */
export interface FactoryDefinition<
  TTable extends Table,
  TTraits extends FactoryTraitsInput<TTable> = {},
> {
  columns(f: FactorySeedFunctions): FactorySeedColumns<TTable>;
  readonly traits: FactoryTraitRegistry<TTable, TTraits, FactoryDefinition<TTable, TTraits>>;
  resetSequence(next?: number): void;
  build(
    overrides?: FactoryOverrides<TTable>,
  ): Promise<import("drizzle-orm").InferInsertModel<TTable>>;
  buildMany(
    count: number,
    overrides?: FactoryOverrides<TTable> | ((index: number) => FactoryOverrides<TTable>),
  ): Promise<import("drizzle-orm").InferInsertModel<TTable>[]>;
}

/**
 * Declarative configuration for `defineFactory(...)`.
 */
export interface DefineFactoryOptions<
  TTable extends Table,
  TTraits extends FactoryTraitsInput<TTable> = {},
> {
  columns?: FactorySeedColumnsInput<TTable>;
  traits?: TTraits;
  inference?: FactoryInferenceOptions<TTable>;
}

/**
 * Creates a reusable definition for one table.
 */
export function defineFactory<TTable extends Table>(table: TTable): FactoryDefinition<TTable, {}>;
export function defineFactory<
  TTable extends Table,
  const TTraits extends FactoryTraitsInput<TTable> = {},
>(
  table: TTable,
  options: DefineFactoryOptions<TTable, TTraits>,
): FactoryDefinition<TTable, TTraits>;
export function defineFactory<TTable extends Table>(
  table: TTable,
  options: DefineFactoryOptions<TTable, FactoryTraitsInput<TTable>> = {},
): FactoryDefinition<TTable, FactoryTraitsInput<TTable>> {
  return (
    defineFactoryRoot as unknown as <TWrappedTable extends Table>(
      wrappedTable: TWrappedTable,
      wrappedOptions?: DefineFactoryOptions<TWrappedTable, FactoryTraitsInput<TWrappedTable>>,
    ) => FactoryDefinition<TWrappedTable, FactoryTraitsInput<TWrappedTable>>
  )(table, options);
}
