import type { Table } from "drizzle-orm";

import {
  FACTORY_INSTANCE,
  fromTable,
  type AutoFactory,
  type FactoryBuildHook,
  type FactoryCallOptions,
  type FactoryCreateHook,
  type FactoryOverrides,
  type FactoryStateInput,
  type FactoryTraitDefinition,
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
 *
 * A definition can build rows in memory, but it does not own database
 * connectivity. Use `createFactories(...)` to execute `create()` against a DB.
 */
export interface FactoryDefinition<TTable extends Table, TTransient extends FactoryTransient = {}> {
  readonly [FACTORY_INSTANCE]: true;
  /**
   * Returns the shared drizzle-seed column generators for this definition.
   *
   * The callback argument matches the official `seed(...).refine((f) => ...)`
   * API from `drizzle-seed`.
   */
  columns(f: FactorySeedFunctions): FactorySeedColumns<TTable>;
  /**
   * Sets default values for this definition.
   */
  defaults(overrides: FactoryOverrides<TTable>): FactoryDefinition<TTable, TTransient>;
  /**
   * Declares extra inputs available from `context.transient`.
   */
  transient<TNextTransient extends FactoryTransient>(
    defaults: TNextTransient,
  ): FactoryDefinition<TTable, TTransient & TNextTransient>;
  /**
   * Adds custom value logic on top of the auto-generated base values.
   */
  state(input: FactoryStateInput<TTable, TTransient>): FactoryDefinition<TTable, TTransient>;
  /**
   * Registers a reusable named variant.
   */
  trait(
    name: string,
    definition: FactoryTraitDefinition<TTable, TTransient>,
  ): FactoryDefinition<TTable, TTransient>;
  /**
   * Applies one or more previously defined traits.
   */
  withTraits(...names: string[]): FactoryDefinition<TTable, TTransient>;
  /**
   * Adds a hook that runs after `build()`.
   */
  afterBuild(hook: FactoryBuildHook<TTable, TTransient>): FactoryDefinition<TTable, TTransient>;
  /**
   * Adds a hook that runs after `create()` when the definition is used in a runtime.
   */
  afterCreate(hook: FactoryCreateHook<TTable, TTransient>): FactoryDefinition<TTable, TTransient>;
  /**
   * Resets the sequence used by auto-generated values.
   */
  resetSequence(next?: number): void;
  /**
   * Builds one row in memory.
   */
  build(
    overrides?: FactoryOverrides<TTable>,
    options?: FactoryCallOptions<TTransient>,
  ): Promise<import("drizzle-orm").InferInsertModel<TTable>>;
  /**
   * Builds many rows in memory.
   */
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
  /**
   * Shared drizzle-seed column generators used by both runtime factories and
   * `seed(...).refine((f) => ...)`.
   */
  columns?: FactorySeedColumnsInput<TTable>;
  /**
   * Advanced schema inference controls for this table.
   */
  inference?: FactoryInferenceOptions<TTable>;
  /**
   * Default transient inputs available from `context.transient`.
   */
  transient?: TTransient;
  /**
   * Default values applied before traits, state, and call-site overrides.
   */
  defaults?: FactoryOverrides<TTable>;
  /**
   * Additional state logic layered on top of the auto-generated values.
   */
  state?: FactoryStateInput<TTable, TTransient>;
  /**
   * Named variants that can later be activated with `withTraits(...)`.
   */
  traits?: Record<string, FactoryTraitDefinition<TTable, TTransient>>;
  /**
   * Hooks that run after `build()`.
   */
  afterBuild?: Hook<FactoryBuildHook<TTable, TTransient>>;
  /**
   * Hooks that run after `create()` when used in a runtime.
   */
  afterCreate?: Hook<FactoryCreateHook<TTable, TTransient>>;
}

/**
 * Creates a reusable definition for one table.
 *
 * Use this when a project wants shared factory modules instead of defining
 * everything inline at the runtime call site.
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
  const fromTableOptions = {
    ...(options.columns ? { columns: options.columns } : {}),
    ...(options.inference ? { inference: options.inference } : {}),
  };
  let factory = fromTable(table, fromTableOptions) as unknown as AutoFactory<TTable, TTransient>;

  if (options.transient) {
    factory = factory.transient(options.transient);
  }

  if (options.defaults) {
    factory = factory.defaults(options.defaults);
  }

  if (options.state) {
    factory = factory.state(options.state);
  }

  if (options.traits) {
    for (const [name, trait] of Object.entries(options.traits)) {
      factory = factory.trait(name, trait);
    }
  }

  for (const hook of normalizeHooks(options.afterBuild)) {
    factory = factory.afterBuild(hook);
  }

  for (const hook of normalizeHooks(options.afterCreate)) {
    factory = factory.afterCreate(hook);
  }

  return factory as unknown as FactoryDefinition<TTable, TTransient>;
}

function normalizeHooks<T>(hooks: Hook<T> | undefined) {
  if (!hooks) {
    return [];
  }

  return Array.isArray(hooks) ? hooks : [hooks];
}
