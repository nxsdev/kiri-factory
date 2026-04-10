import type { InferInsertModel, InferSelectModel, Table } from "drizzle-orm";

import { existing as existingRoot } from "../../shared/src/core";

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
 * Wraps an existing row so relation planning can reuse it instead of creating another row.
 */
export interface ExistingRow<TTable extends Table> {
  readonly row: InferSelectModel<TTable>;
  readonly table: TTable;
}

/**
 * One created row plus any explicitly planned related rows.
 */
export interface FactoryGraphNode<
  TRow extends Record<string, unknown> = Record<string, unknown>,
  TRelations extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly row: TRow;
  readonly source: "created" | "existing";
  readonly relations: TRelations;
}

/**
 * Marks an existing row for reuse in relation planning.
 */
export function existing<TTable extends Table>(
  table: TTable,
  row: InferSelectModel<TTable>,
): ExistingRow<TTable> {
  return existingRoot(
    table as unknown as Parameters<typeof existingRoot>[0],
    row as unknown as Parameters<typeof existingRoot>[1],
  ) as unknown as ExistingRow<TTable>;
}

/**
 * Context available while refining a factory.
 */
export type FactoryStateContext<TTable extends Table, TTransient extends FactoryTransient = {}> = {
  readonly seq: number;
  readonly strategy: "build" | "create";
  readonly table: TTable;
  readonly transient: Readonly<TTransient>;
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
