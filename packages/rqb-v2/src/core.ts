import type { InferInsertModel, InferSelectModel, Table } from "drizzle-orm";

import type { FactoryDefinition } from "./define";

type FactoryTransient = Record<string, unknown>;

/**
 * Per-call column overrides passed to `build()` and `create()`.
 */
export type FactoryOverrides<TTable extends Table> = Partial<InferInsertModel<TTable>>;

/**
 * Extra per-call options passed to `build()` and `create()`.
 */
export interface FactoryCallOptions<TTransient extends FactoryTransient = {}> {
  transient?: Partial<TTransient>;
}

/**
 * Context available while refining a factory.
 */
export type FactoryStateContext<TTable extends Table, TTransient extends FactoryTransient = {}> = {
  readonly seq: number;
  readonly strategy: "build" | "create";
  readonly table: TTable;
  readonly transient: Readonly<Partial<TTransient>>;
  readonly values: Readonly<Partial<InferInsertModel<TTable>>>;
  readonly use: <TOtherTable extends Table, TOtherTransient extends FactoryTransient>(
    factory: FactoryDefinition<TOtherTable, TOtherTransient>,
  ) => FactoryDefinition<TOtherTable, TOtherTransient>;
};

/**
 * A reusable refinement for factory values.
 */
export type FactoryStateInput<TTable extends Table, TTransient extends FactoryTransient = {}> =
  | Partial<InferInsertModel<TTable>>
  | ((
      context: FactoryStateContext<TTable, TTransient>,
    ) => Partial<InferInsertModel<TTable>> | Promise<Partial<InferInsertModel<TTable>>>);

/**
 * Runs after `build()` resolves values.
 */
export type FactoryBuildHook<TTable extends Table, TTransient extends FactoryTransient = {}> = (
  values: InferInsertModel<TTable>,
  context: FactoryStateContext<TTable, TTransient>,
) => void | Promise<void>;

/**
 * Runs after `create()` persists a row.
 */
export type FactoryCreateHook<TTable extends Table, TTransient extends FactoryTransient = {}> = (
  row: InferSelectModel<TTable>,
  context: FactoryStateContext<TTable, TTransient> & {
    readonly input: InferInsertModel<TTable>;
  },
) => void | Promise<void>;

/**
 * A named trait that can change values and register hooks.
 */
export interface FactoryTrait<TTable extends Table, TTransient extends FactoryTransient = {}> {
  state?: FactoryStateInput<TTable, TTransient>;
  afterBuild?: FactoryBuildHook<TTable, TTransient> | FactoryBuildHook<TTable, TTransient>[];
  afterCreate?: FactoryCreateHook<TTable, TTransient> | FactoryCreateHook<TTable, TTransient>[];
}

/**
 * Shorthand accepted by `trait(name, definition)`.
 */
export type FactoryTraitDefinition<TTable extends Table, TTransient extends FactoryTransient = {}> =
  | FactoryStateInput<TTable, TTransient>
  | FactoryTrait<TTable, TTransient>;
