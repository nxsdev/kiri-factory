import {
  getTableColumns,
  type Column,
  type InferInsertModel,
  type InferSelectModel,
  type Table,
} from "drizzle-orm";

import { drizzleReturning } from "./drizzle";
import {
  extractRuntimeRelations,
  type RuntimeRelationMetadata,
  type RuntimeRelations,
} from "./internal/drizzle-relations";
import { getSingleColumnForeignKeys, isTable, tableNameOf } from "./internal/drizzle-introspection";
import type { FactoryAdapter, FactoryBinding } from "./types";

const SKIP_VALUE = Symbol("kiri-factory.skip");
export const FACTORY_INSTANCE = Symbol("kiri-factory.instance");

type SkipValue = typeof SKIP_VALUE;
type InferredValue =
  | SkipValue
  | string
  | number
  | boolean
  | bigint
  | Date
  | Uint8Array
  | Record<string, unknown>
  | unknown[];
type MaybePromise<T> = T | Promise<T>;
type FactoryTransient = Record<string, unknown>;
type InferInsert<TTable extends Table> = InferInsertModel<TTable>;
type InferSelect<TTable extends Table> = InferSelectModel<TTable>;
type Simplify<T> = { [K in keyof T]: T[K] } & {};
type UntypedOverrides = Record<string, unknown>;
const EXISTING_ROW = Symbol("kiri-factory.existing-row");

type RuntimeBinding<DB = unknown> = FactoryBinding<DB> & {
  registry?: Map<Table, AutoFactory<Table, FactoryTransient>>;
  relations?: RuntimeRelations;
};

/**
 * Per-call column overrides passed to `build()` and `create()`.
 */
export type FactoryOverrides<TTable extends Table> = Partial<InferInsert<TTable>>;

/**
 * Extra per-call options passed to `build()` and `create()`.
 */
export interface FactoryCallOptions<TTransient extends FactoryTransient = {}> {
  /**
   * Extra values available inside `state(...)`. They are never persisted.
   */
  transient?: Partial<TTransient>;
}

/**
 * Wraps an existing row so relation planning can reuse it instead of creating
 * another related row.
 */
export interface ExistingRow<TTable extends Table> {
  readonly [EXISTING_ROW]: true;
  readonly row: InferSelect<TTable>;
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
  row: InferSelect<TTable>,
): ExistingRow<TTable> {
  return Object.freeze({
    [EXISTING_ROW]: true,
    row,
    table,
  }) as ExistingRow<TTable>;
}

/**
 * Context available while refining a factory.
 */
export type FactoryStateContext<TTable extends Table, TTransient extends FactoryTransient = {}> = {
  /**
   * Monotonic sequence number for the current factory.
   */
  readonly seq: number;
  /**
   * Whether the current run is building in memory or persisting to the database.
   */
  readonly strategy: "build" | "create";
  /**
   * The Drizzle table being built.
   */
  readonly table: TTable;
  /**
   * Extra values declared with `transient(...)` and optional per-call inputs.
   */
  readonly transient: Readonly<TTransient>;
  /**
   * Values resolved so far.
   */
  readonly values: Readonly<Partial<InferInsert<TTable>>>;
  /**
   * Reuses another factory and carries over the current runtime automatically.
   */
  readonly use: <TOtherTable extends Table, TOtherTransient extends FactoryTransient>(
    factory: AutoFactory<TOtherTable, TOtherTransient>,
  ) => AutoFactory<TOtherTable, TOtherTransient>;
};

/**
 * A reusable refinement for factory values.
 */
export type FactoryStateInput<TTable extends Table, TTransient extends FactoryTransient = {}> =
  | Partial<InferInsert<TTable>>
  | ((
      context: FactoryStateContext<TTable, TTransient>,
    ) => MaybePromise<Partial<InferInsert<TTable>>>);

/**
 * Runs after `build()` resolves values.
 */
export type FactoryBuildHook<TTable extends Table, TTransient extends FactoryTransient = {}> = (
  values: InferInsert<TTable>,
  context: FactoryStateContext<TTable, TTransient>,
) => MaybePromise<void>;

/**
 * Runs after `create()` persists a row.
 */
export type FactoryCreateHook<TTable extends Table, TTransient extends FactoryTransient = {}> = (
  row: InferSelect<TTable>,
  context: FactoryStateContext<TTable, TTransient> & {
    readonly input: InferInsert<TTable>;
  },
) => MaybePromise<void>;

/**
 * A named trait that can change values and register hooks.
 */
export interface FactoryTrait<TTable extends Table, TTransient extends FactoryTransient = {}> {
  /**
   * Reusable state applied when the trait is active.
   */
  state?: FactoryStateInput<TTable, TTransient>;
  /**
   * Hooks run after `build()`.
   */
  afterBuild?: FactoryBuildHook<TTable, TTransient> | FactoryBuildHook<TTable, TTransient>[];
  /**
   * Hooks run after `create()`.
   */
  afterCreate?: FactoryCreateHook<TTable, TTransient> | FactoryCreateHook<TTable, TTransient>[];
}

/**
 * Shorthand accepted by `trait(name, definition)`.
 */
export type FactoryTraitDefinition<TTable extends Table, TTransient extends FactoryTransient = {}> =
  | FactoryStateInput<TTable, TTransient>
  | FactoryTrait<TTable, TTransient>;

type NormalizedTrait<TTable extends Table, TTransient extends FactoryTransient = {}> = {
  state: Array<
    (context: FactoryStateContext<TTable, TTransient>) => MaybePromise<Partial<InferInsert<TTable>>>
  >;
  afterBuild: FactoryBuildHook<TTable, TTransient>[];
  afterCreate: FactoryCreateHook<TTable, TTransient>[];
};

type ResolvedExecution<TTable extends Table, TTransient extends FactoryTransient = {}> = {
  seq: number;
  transient: TTransient;
  values: InferInsert<TTable>;
  use: <TOtherTable extends Table, TOtherTransient extends FactoryTransient>(
    factory: AutoFactory<TOtherTable, TOtherTransient>,
  ) => AutoFactory<TOtherTable, TOtherTransient>;
};

type InternalState<TTable extends Table, TTransient extends FactoryTransient = {}> = {
  table: TTable;
  sequence: SequenceTracker;
  runtime?: RuntimeBinding;
  hasRelations: HasRelationPlan[];
  forRelations: ForRelationPlan[];
  traits: Record<string, NormalizedTrait<TTable, TTransient>>;
  activeTraits: string[];
  defaultResolvers: Array<
    (context: FactoryStateContext<TTable, TTransient>) => MaybePromise<Partial<InferInsert<TTable>>>
  >;
  stateResolvers: Array<
    (context: FactoryStateContext<TTable, TTransient>) => MaybePromise<Partial<InferInsert<TTable>>>
  >;
  afterBuildHooks: FactoryBuildHook<TTable, TTransient>[];
  afterCreateHooks: FactoryCreateHook<TTable, TTransient>[];
  transientDefaults: Partial<TTransient>;
};

type ListOverridesInput<TTable extends Table> =
  | FactoryOverrides<TTable>
  | ((index: number) => FactoryOverrides<TTable>);
type UntypedListOverridesInput = UntypedOverrides | ((index: number) => UntypedOverrides);
type UntypedRelationInput =
  | UntypedOverrides
  | ExistingRow<Table>
  | AutoFactory<Table, FactoryTransient>;
type UntypedGraphNode = FactoryGraphNode<Record<string, unknown>, UntypedGraphRelations>;
type UntypedGraphRelations = Record<string, UntypedGraphNode | UntypedGraphNode[]>;
type ForRelationPlan = {
  input: UntypedRelationInput;
  relationKey: string;
};
type HasRelationPlan = {
  count: number;
  expectedKind: "one" | "many";
  input: AutoFactory<Table, FactoryTransient> | undefined;
  overrides: UntypedListOverridesInput;
  relationKey: string;
};

class SequenceTracker {
  #current = 0;

  next() {
    this.#current += 1;
    return this.#current;
  }

  reset(next = 0) {
    this.#current = next;
  }

  clone() {
    const tracker = new SequenceTracker();
    tracker.reset(this.#current);
    return tracker;
  }
}

/**
 * Auto-generated, schema-driven factory for a single Drizzle table.
 *
 * Precedence is stable and intentional:
 * `auto values -> defaults() -> withTraits() -> state() -> call-site overrides`.
 */
export class AutoFactory<TTable extends Table, TTransient extends FactoryTransient = {}> {
  readonly [FACTORY_INSTANCE] = true;
  readonly #state: InternalState<TTable, TTransient>;

  constructor(state: InternalState<TTable, TTransient>) {
    this.#state = state;
  }

  /**
   * Attaches a database so `create()` can persist rows.
   *
   * When no adapter is supplied, kiri-factory uses Drizzle's `returning()`
   * support by default.
   */
  connect<DB>(db: DB, options?: { adapter?: FactoryAdapter<DB> }): AutoFactory<TTable, TTransient>;
  connect<DB>(binding: FactoryBinding<DB>): AutoFactory<TTable, TTransient>;
  connect<DB>(dbOrBinding: DB | FactoryBinding<DB>, options?: { adapter?: FactoryAdapter<DB> }) {
    return this.#clone({
      sequence: this.#state.sequence.clone(),
      runtime: normalizeRuntime(
        dbOrBinding,
        options?.adapter,
        this.#state.runtime?.registry,
        this.#state.runtime?.relations,
      ),
    });
  }

  /**
   * Sets default values for this factory.
   */
  defaults(overrides: FactoryOverrides<TTable>) {
    return this.#clone({
      defaultResolvers: [...this.#state.defaultResolvers, normalizeStateInput(overrides)],
    });
  }

  /**
   * Declares extra inputs that can be read from `context.transient`.
   */
  transient<TNextTransient extends FactoryTransient>(defaults: TNextTransient) {
    return new AutoFactory<TTable, Simplify<TTransient & TNextTransient>>({
      ...(this.#state as unknown as InternalState<TTable, Simplify<TTransient & TNextTransient>>),
      transientDefaults: mergeDefined(
        this.#state.transientDefaults,
        defaults as Partial<TTransient>,
      ) as Partial<Simplify<TTransient & TNextTransient>>,
    });
  }

  /**
   * Adds custom value logic on top of the auto-generated base values.
   */
  state(input: FactoryStateInput<TTable, TTransient>) {
    return this.#clone({
      stateResolvers: [...this.#state.stateResolvers, normalizeStateInput(input)],
    });
  }

  /**
   * Registers a reusable named variant.
   */
  trait(name: string, definition: FactoryTraitDefinition<TTable, TTransient>) {
    return this.#clone({
      traits: {
        ...this.#state.traits,
        [name]: normalizeTrait(definition),
      },
    });
  }

  /**
   * Applies one or more previously defined traits.
   */
  withTraits(...names: string[]) {
    for (const name of names) {
      if (!this.#state.traits[name]) {
        throw new Error(`Unknown trait "${name}" for table "${tableNameOf(this.#state.table)}".`);
      }
    }

    return this.#clone({
      activeTraits: [...this.#state.activeTraits, ...names],
    });
  }

  /**
   * Adds a hook that runs after `build()`.
   */
  afterBuild(hook: FactoryBuildHook<TTable, TTransient>) {
    return this.#clone({
      afterBuildHooks: [...this.#state.afterBuildHooks, hook],
    });
  }

  /**
   * Adds a hook that runs after `create()`.
   */
  afterCreate(hook: FactoryCreateHook<TTable, TTransient>) {
    return this.#clone({
      afterCreateHooks: [...this.#state.afterCreateHooks, hook],
    });
  }

  /**
   * Plans a belongs-to relation for the next `create()` call.
   *
   * This only works when the connected runtime was created from a Drizzle
   * schema object that also exports `relations(...)`.
   */
  for(relationKey: string, input: UntypedRelationInput = {}) {
    assertUniqueRelationPlan(this.#state.forRelations, relationKey, "for");

    return this.#clone({
      forRelations: [...this.#state.forRelations, { input, relationKey }],
    });
  }

  /**
   * Plans a single child row for the next `create()` call.
   *
   * This only works when the connected runtime was created from a Drizzle
   * schema object that also exports `relations(...)`.
   */
  hasOne(relationKey: string, input: UntypedOverrides | AutoFactory<Table, FactoryTransient> = {}) {
    assertUniqueRelationPlan(this.#state.hasRelations, relationKey, "hasOne");

    return this.#clone({
      hasRelations: [
        ...this.#state.hasRelations,
        {
          count: 1,
          expectedKind: "one",
          input: isFactoryInstance(input) ? input : undefined,
          overrides: isFactoryInstance(input) ? {} : input,
          relationKey,
        },
      ],
    });
  }

  /**
   * Plans many child rows for the next `create()` call.
   *
   * This only works when the connected runtime was created from a Drizzle
   * schema object that also exports `relations(...)`.
   */
  hasMany(
    relationKey: string,
    count = 1,
    input: UntypedListOverridesInput | AutoFactory<Table, FactoryTransient> = {},
  ) {
    assertPositiveCount(count);
    assertUniqueRelationPlan(this.#state.hasRelations, relationKey, "hasMany");

    return this.#clone({
      hasRelations: [
        ...this.#state.hasRelations,
        {
          count,
          expectedKind: "many",
          input: isFactoryInstance(input) ? input : undefined,
          overrides: isFactoryInstance(input) ? {} : input,
          relationKey,
        },
      ],
    });
  }

  /**
   * Resets the sequence used by auto-generated values.
   */
  resetSequence(next = 0) {
    this.#state.sequence.reset(next);
  }

  /**
   * Builds one row in memory.
   */
  async build(
    overrides: FactoryOverrides<TTable> = {},
    options: FactoryCallOptions<TTransient> = {},
  ) {
    return (await this.#resolve("build", overrides, options, [])).values;
  }

  /**
   * Alias for `build()`.
   */
  async make(
    overrides: FactoryOverrides<TTable> = {},
    options: FactoryCallOptions<TTransient> = {},
  ) {
    return this.build(overrides, options);
  }

  /**
   * Builds many rows in memory.
   */
  async buildList(
    count: number,
    overrides: ListOverridesInput<TTable> = {},
    options: FactoryCallOptions<TTransient> = {},
  ) {
    return this.#buildListLike(count, overrides, options, "build");
  }

  /**
   * Alias for `buildList()`.
   */
  async makeList(
    count: number,
    overrides: ListOverridesInput<TTable> = {},
    options: FactoryCallOptions<TTransient> = {},
  ) {
    return this.buildList(count, overrides, options);
  }

  /**
   * Builds one row and persists it to the configured database.
   */
  async create(
    overrides: FactoryOverrides<TTable> = {},
    options: FactoryCallOptions<TTransient> = {},
  ) {
    return this.#createInternal(overrides, options, []);
  }

  /**
   * Builds one row, persists it, and returns a nested graph of explicitly
   * planned related rows.
   */
  async createGraph(
    overrides: FactoryOverrides<TTable> = {},
    options: FactoryCallOptions<TTransient> = {},
  ) {
    return this.#createGraphInternal(overrides, options, []);
  }

  /**
   * Builds and persists many rows.
   */
  async createList(
    count: number,
    overrides: ListOverridesInput<TTable> = {},
    options: FactoryCallOptions<TTransient> = {},
  ) {
    assertPositiveCount(count);
    const results: InferSelect<TTable>[] = [];

    for (let index = 0; index < count; index += 1) {
      results.push(await this.#createInternal(resolveListOverrides(overrides, index), options, []));
    }

    return results;
  }

  /**
   * Builds, persists, and returns many nested graphs.
   */
  async createGraphList(
    count: number,
    overrides: ListOverridesInput<TTable> = {},
    options: FactoryCallOptions<TTransient> = {},
  ) {
    assertPositiveCount(count);
    const results: Array<FactoryGraphNode<InferSelect<TTable>, UntypedGraphRelations>> = [];

    for (let index = 0; index < count; index += 1) {
      results.push(
        await this.#createGraphInternal(resolveListOverrides(overrides, index), options, []),
      );
    }

    return results;
  }

  #clone(overrides: Partial<InternalState<TTable, TTransient>>) {
    return new AutoFactory<TTable, TTransient>({
      ...this.#state,
      ...overrides,
    });
  }

  async #createInternal(
    overrides: FactoryOverrides<TTable>,
    options: FactoryCallOptions<TTransient>,
    path: Table[],
  ) {
    return (await this.#createNodeInternal(overrides, options, path, false)).row;
  }

  async #createGraphInternal(
    overrides: FactoryOverrides<TTable>,
    options: FactoryCallOptions<TTransient>,
    path: Table[],
  ) {
    return this.#createNodeInternal(overrides, options, path, true);
  }

  async #createNodeInternal(
    overrides: FactoryOverrides<TTable>,
    options: FactoryCallOptions<TTransient>,
    path: Table[],
    includeGraph: boolean,
  ): Promise<FactoryGraphNode<InferSelect<TTable>, UntypedGraphRelations>> {
    if (!this.#state.runtime) {
      throw new Error(
        `Factory for table "${tableNameOf(this.#state.table)}" is not connected. Call connect(db) before create().`,
      );
    }

    const relations = {} as UntypedGraphRelations;
    const resolved = await this.#resolve(
      "create",
      overrides,
      options,
      path,
      includeGraph ? relations : undefined,
    );
    const row = await this.#state.runtime.adapter.create({
      db: this.#state.runtime.db,
      table: this.#state.table,
      values: resolved.values,
    });

    await this.#createPlannedChildren(row, path, includeGraph ? relations : undefined);

    const context = this.#createContext(
      "create",
      resolved.seq,
      resolved.transient,
      resolved.values,
      resolved.use,
    );

    for (const hook of this.#collectAfterCreateHooks()) {
      await hook(row, {
        ...context,
        input: resolved.values,
      });
    }

    return {
      relations,
      row,
      source: "created",
    };
  }

  async #buildListLike(
    count: number,
    overrides: ListOverridesInput<TTable>,
    options: FactoryCallOptions<TTransient>,
    strategy: "build" | "create",
  ) {
    assertPositiveCount(count);
    const results: InferInsert<TTable>[] = [];

    for (let index = 0; index < count; index += 1) {
      results.push(
        (await this.#resolve(strategy, resolveListOverrides(overrides, index), options, [])).values,
      );
    }

    return results;
  }

  async #resolve(
    strategy: "build" | "create",
    overrides: FactoryOverrides<TTable>,
    options: FactoryCallOptions<TTransient>,
    path: Table[],
    graph?: UntypedGraphRelations,
  ): Promise<ResolvedExecution<TTable, TTransient>> {
    const seq = this.#state.sequence.next();
    const transient = mergeDefined(this.#state.transientDefaults, options.transient) as TTransient;
    const use = <TOtherTable extends Table, TOtherTransient extends FactoryTransient>(
      factory: AutoFactory<TOtherTable, TOtherTransient>,
    ) => (this.#state.runtime ? factory.connect(this.#state.runtime) : factory);
    let values = inferAutoValues(
      this.#state.table,
      seq,
      getRelationOwnedColumnKeys(this.#state.table, this.#state.runtime?.relations),
    );

    for (const resolver of this.#collectStateResolvers()) {
      const patch = await resolver(this.#createContext(strategy, seq, transient, values, use));
      values = mergeDefined(values, patch);
    }

    values = mergeDefined(values, overrides);
    values = pruneUndefined(values) as Partial<InferInsert<TTable>>;

    if (strategy === "create") {
      values = await this.#resolvePlannedParents(values, path, graph);
      values = await this.#resolveMissingForeignKeys(values, path);
    }

    ensureRequiredColumns(this.#state.table, values);

    const finalValues = values as InferInsert<TTable>;
    const buildContext = this.#createContext(strategy, seq, transient, finalValues, use);

    for (const hook of this.#collectAfterBuildHooks()) {
      await hook(finalValues, buildContext);
    }

    return {
      seq,
      transient,
      values: finalValues,
      use,
    };
  }

  async #resolvePlannedParents(
    values: Partial<InferInsert<TTable>>,
    path: Table[],
    graph?: UntypedGraphRelations,
  ) {
    if (!this.#state.runtime?.registry || !this.#state.runtime.relations) {
      return values;
    }

    const resolved = { ...values };

    for (const plan of this.#state.forRelations) {
      const relation = this.#getRequiredRelation(plan.relationKey);

      if (!canUseForRelation(relation)) {
        throw new Error(
          `Relation "${plan.relationKey}" on "${tableNameOf(this.#state.table)}" is not a belongs-to relation. Use hasOne(...) or hasMany(...) on the parent side instead.`,
        );
      }

      const parentFactory = this.#state.runtime.registry.get(relation.targetTable);

      if (!parentFactory) {
        throw new Error(
          `Relation "${plan.relationKey}" on "${tableNameOf(this.#state.table)}" points to "${tableNameOf(relation.targetTable)}", but that table is not registered in this runtime.`,
        );
      }

      const parentFactoryInput = isFactoryInstance(plan.input)
        ? this.#state.runtime
          ? plan.input.connect(this.#state.runtime)
          : plan.input
        : parentFactory;
      const parentOverrides =
        isFactoryInstance(plan.input) || isExistingRow(plan.input) ? {} : plan.input;
      if (isExistingRow(plan.input) && plan.input.table !== relation.targetTable) {
        throw new Error(
          `Relation "${plan.relationKey}" on "${tableNameOf(this.#state.table)}" expects "${tableNameOf(relation.targetTable)}", but existing(...) received "${tableNameOf(plan.input.table)}".`,
        );
      }
      const parentNode = isExistingRow(plan.input)
        ? ({
            relations: {},
            row: plan.input.row,
            source: "existing",
          } satisfies UntypedGraphNode)
        : graph
          ? await parentFactoryInput.#createGraphInternal(parentOverrides, {}, [
              ...path,
              this.#state.table,
            ])
          : undefined;
      const parent = parentNode
        ? parentNode.row
        : await parentFactoryInput.#createInternal(parentOverrides, {}, [
            ...path,
            this.#state.table,
          ]);

      for (let index = 0; index < relation.sourceKeys.length; index += 1) {
        const sourceKey = relation.sourceKeys[index]!;
        const targetKey = relation.targetKeys[index]!;

        (resolved as Record<string, unknown>)[sourceKey] = (parent as Record<string, unknown>)[
          targetKey
        ];
      }

      if (graph && parentNode) {
        graph[plan.relationKey] = parentNode;
      }
    }

    return resolved;
  }

  async #resolveMissingForeignKeys(values: Partial<InferInsert<TTable>>, path: Table[]) {
    if (!this.#state.runtime?.registry) {
      return values;
    }

    const missing = listMissingRequiredColumns(this.#state.table, values);

    if (missing.length === 0) {
      return values;
    }

    const resolved = { ...values };
    const foreignKeys = getSingleColumnForeignKeys(this.#state.table);

    for (const foreignKey of foreignKeys) {
      if (!(foreignKey.localKey in resolved) && missing.includes(foreignKey.localKey)) {
        const parentFactory = this.#state.runtime.registry.get(foreignKey.foreignTable);

        if (!parentFactory) {
          continue;
        }

        if (path.includes(foreignKey.foreignTable)) {
          throw new Error(
            `Could not auto-create "${tableNameOf(foreignKey.foreignTable)}" for "${tableNameOf(this.#state.table)}" because the foreign-key chain is cyclic. Add explicit overrides or state().`,
          );
        }

        const parent = await parentFactory.#createInternal({}, {}, [...path, this.#state.table]);
        (resolved as Record<string, unknown>)[foreignKey.localKey] = (
          parent as Record<string, unknown>
        )[foreignKey.foreignKey];
      }
    }

    return resolved;
  }

  async #createPlannedChildren(
    row: InferSelect<TTable>,
    path: Table[],
    graph?: UntypedGraphRelations,
  ) {
    if (!this.#state.runtime?.registry || !this.#state.runtime.relations) {
      return;
    }

    for (const plan of this.#state.hasRelations) {
      const relation = this.#getRequiredRelation(plan.relationKey);

      if (plan.expectedKind === "one") {
        if (!canUseHasOneRelation(relation)) {
          throw new Error(
            `Relation "${plan.relationKey}" on "${tableNameOf(this.#state.table)}" is not a has-one relation. Use hasMany(...) for to-many edges or for(...) on the child side instead.`,
          );
        }
      } else if (plan.expectedKind === "many") {
        if (!canUseHasManyRelation(relation)) {
          throw new Error(
            `Relation "${plan.relationKey}" on "${tableNameOf(this.#state.table)}" is not a has-many relation. Use hasOne(...) for inverse one-to-one edges or for(...) on the child side instead.`,
          );
        }
      }

      const childFactory = this.#state.runtime.registry.get(relation.targetTable);

      if (!childFactory) {
        throw new Error(
          `Relation "${plan.relationKey}" on "${tableNameOf(this.#state.table)}" points to "${tableNameOf(relation.targetTable)}", but that table is not registered in this runtime.`,
        );
      }

      const plannedChildFactory =
        isFactoryInstance(plan.input) && this.#state.runtime
          ? plan.input.connect(this.#state.runtime)
          : isFactoryInstance(plan.input)
            ? plan.input
            : childFactory;
      const createdChildren: UntypedGraphNode[] = [];

      for (let index = 0; index < plan.count; index += 1) {
        const overrides = {
          ...resolveUntypedListOverrides(plan.overrides, index),
        };

        for (
          let relationIndex = 0;
          relationIndex < relation.sourceKeys.length;
          relationIndex += 1
        ) {
          const sourceKey = relation.sourceKeys[relationIndex]!;
          const targetKey = relation.targetKeys[relationIndex]!;

          overrides[targetKey] = (row as Record<string, unknown>)[sourceKey];
        }

        const childGraph = graph
          ? await plannedChildFactory.#createGraphInternal(
              overrides as FactoryOverrides<Table>,
              {},
              [...path, this.#state.table],
            )
          : undefined;

        if (!graph) {
          await plannedChildFactory.#createInternal(overrides as FactoryOverrides<Table>, {}, [
            ...path,
            this.#state.table,
          ]);
        } else if (childGraph) {
          createdChildren.push(childGraph);
        }
      }

      if (graph) {
        if (plan.expectedKind === "one") {
          if (createdChildren[0]) {
            graph[plan.relationKey] = createdChildren[0];
          }
        } else {
          graph[plan.relationKey] = createdChildren;
        }
      }
    }
  }

  #collectStateResolvers() {
    const traitResolvers = this.#state.activeTraits.flatMap(
      (name) => this.#state.traits[name]!.state,
    );

    return [...this.#state.defaultResolvers, ...traitResolvers, ...this.#state.stateResolvers];
  }

  #collectAfterBuildHooks() {
    const traitHooks = this.#state.activeTraits.flatMap(
      (name) => this.#state.traits[name]!.afterBuild,
    );

    return [...traitHooks, ...this.#state.afterBuildHooks];
  }

  #collectAfterCreateHooks() {
    const traitHooks = this.#state.activeTraits.flatMap(
      (name) => this.#state.traits[name]!.afterCreate,
    );

    return [...traitHooks, ...this.#state.afterCreateHooks];
  }

  #createContext(
    strategy: "build" | "create",
    seq: number,
    transient: TTransient,
    values: Partial<InferInsert<TTable>>,
    use: <TOtherTable extends Table, TOtherTransient extends FactoryTransient>(
      factory: AutoFactory<TOtherTable, TOtherTransient>,
    ) => AutoFactory<TOtherTable, TOtherTransient>,
  ): FactoryStateContext<TTable, TTransient> {
    return {
      seq,
      strategy,
      table: this.#state.table,
      transient,
      values,
      use,
    };
  }

  #getRequiredRelation(relationKey: string) {
    const relation = this.#state.runtime?.relations?.get(this.#state.table, relationKey);

    if (!relation) {
      throw new Error(
        `Relation "${relationKey}" is not available on "${tableNameOf(this.#state.table)}". Pass a schema object that exports Drizzle relations(...) definitions.`,
      );
    }

    return relation;
  }
}

/**
 * Creates a schema-driven factory for one Drizzle table.
 */
export function fromTable<TTable extends Table>(table: TTable) {
  return new AutoFactory<TTable>({
    table,
    sequence: new SequenceTracker(),
    hasRelations: [],
    forRelations: [],
    traits: {},
    activeTraits: [],
    defaultResolvers: [],
    stateResolvers: [],
    afterBuildHooks: [],
    afterCreateHooks: [],
    transientDefaults: {},
  });
}

type ExtractTables<TSchema extends Record<string, unknown>> = {
  [K in keyof TSchema as TSchema[K] extends Table ? K : never]: TSchema[K];
};

export type SchemaFactories<TSchema extends Record<string, unknown>> = Simplify<
  {
    [K in keyof ExtractTables<TSchema>]: ExtractTables<TSchema>[K] extends Table
      ? AutoFactory<ExtractTables<TSchema>[K]>
      : never;
  } & {
    connect<DB>(db: DB, options?: { adapter?: FactoryAdapter<DB> }): SchemaFactories<TSchema>;
    connect<DB>(binding: FactoryBinding<DB>): SchemaFactories<TSchema>;
    resetSequences(next?: number): void;
  }
>;

/**
 * Creates a factory registry for every Drizzle table in a schema object.
 */
export function fromSchema<TSchema extends Record<string, unknown>>(
  schema: TSchema,
): SchemaFactories<TSchema> {
  const registry: Record<string, unknown> = {};
  const entries: Array<[Table, string]> = [];
  const runtimeRelations = extractRuntimeRelations(schema);

  for (const [key, value] of Object.entries(schema)) {
    if (isTable(value)) {
      registry[key] = fromTable(value);
      entries.push([value, key]);
    }
  }

  attachRegistryHelpers(registry, entries, runtimeRelations);

  return registry as SchemaFactories<TSchema>;
}

function attachRegistryHelpers(
  registry: Record<string, unknown>,
  entries: Array<[Table, string]>,
  runtimeRelations?: RuntimeRelations,
) {
  Object.defineProperty(registry, "connect", {
    enumerable: false,
    value<DB>(dbOrBinding: DB | FactoryBinding<DB>, options?: { adapter?: FactoryAdapter<DB> }) {
      const baseRuntime = normalizeRuntime(
        dbOrBinding,
        options?.adapter,
        undefined,
        runtimeRelations,
      );
      const connected: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(registry)) {
        if (isFactoryInstance(value)) {
          connected[key] = value.connect(baseRuntime);
        }
      }

      const factoryMap = new Map<Table, AutoFactory<Table, FactoryTransient>>();

      for (const [table, key] of entries) {
        const value = connected[key];
        if (isFactoryInstance(value)) {
          factoryMap.set(table, value as AutoFactory<Table, FactoryTransient>);
        }
      }

      const runtime = withOptionalRegistry(baseRuntime, factoryMap, runtimeRelations);
      const resolved: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(connected)) {
        if (isFactoryInstance(value)) {
          resolved[key] = value.connect(runtime);
        }
      }

      attachRegistryHelpers(resolved, entries, runtimeRelations);

      return resolved;
    },
  });

  Object.defineProperty(registry, "resetSequences", {
    enumerable: false,
    value(next = 0) {
      for (const value of Object.values(registry)) {
        if (isFactoryInstance(value)) {
          value.resetSequence(next);
        }
      }
    },
  });
}

function normalizeRuntime<DB>(
  dbOrBinding: DB | FactoryBinding<DB>,
  adapter?: FactoryAdapter<DB>,
  registry?: Map<Table, AutoFactory<Table, FactoryTransient>>,
  relations?: RuntimeRelations,
): RuntimeBinding<DB> {
  if (isFactoryBinding(dbOrBinding)) {
    return withOptionalRegistry(
      {
        ...dbOrBinding,
      },
      registry ?? (dbOrBinding as RuntimeBinding<DB>).registry,
      relations ?? (dbOrBinding as RuntimeBinding<DB>).relations,
    );
  }

  return withOptionalRegistry(
    {
      db: dbOrBinding,
      adapter: adapter ?? drizzleReturning<DB>(),
    },
    registry,
    relations,
  );
}

function withOptionalRegistry<DB>(
  binding: FactoryBinding<DB>,
  registry?: Map<Table, AutoFactory<Table, FactoryTransient>>,
  relations?: RuntimeRelations,
) {
  if (!registry && !relations) {
    return binding as RuntimeBinding<DB>;
  }

  return {
    ...binding,
    registry,
    relations,
  } as RuntimeBinding<DB>;
}

function isFactoryBinding<DB>(value: DB | FactoryBinding<DB>): value is FactoryBinding<DB> {
  return Boolean(
    value &&
    typeof value === "object" &&
    "db" in value &&
    "adapter" in value &&
    typeof (value as { adapter?: { create?: unknown } }).adapter?.create === "function",
  );
}

function normalizeStateInput<
  TTable extends Table,
  TTransient extends FactoryTransient = Record<string, never>,
>(input: FactoryStateInput<TTable, TTransient>) {
  if (typeof input === "function") {
    return input;
  }

  return async () => input;
}

function normalizeTrait<
  TTable extends Table,
  TTransient extends FactoryTransient = Record<string, never>,
>(definition: FactoryTraitDefinition<TTable, TTransient>): NormalizedTrait<TTable, TTransient> {
  const trait = isTraitConfig(definition) ? definition : { state: definition };

  return {
    state: trait.state ? [normalizeStateInput(trait.state)] : [],
    afterBuild: normalizeHooks(trait.afterBuild),
    afterCreate: normalizeHooks(trait.afterCreate),
  };
}

function isTraitConfig<
  TTable extends Table,
  TTransient extends FactoryTransient = Record<string, never>,
>(value: FactoryTraitDefinition<TTable, TTransient>): value is FactoryTrait<TTable, TTransient> {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    ("state" in value || "afterBuild" in value || "afterCreate" in value),
  );
}

function normalizeHooks<T>(hooks: T | T[] | undefined): T[] {
  if (!hooks) {
    return [];
  }

  return Array.isArray(hooks) ? hooks : [hooks];
}

function resolveListOverrides<TTable extends Table>(
  input: ListOverridesInput<TTable>,
  index: number,
) {
  return typeof input === "function" ? input(index) : input;
}

function resolveUntypedListOverrides(input: UntypedListOverridesInput, index: number) {
  return typeof input === "function" ? input(index) : input;
}

function assertUniqueRelationPlan(
  plans: Array<{ relationKey: string }>,
  relationKey: string,
  methodName: "for" | "hasOne" | "hasMany",
) {
  if (plans.some((plan) => plan.relationKey === relationKey)) {
    throw new Error(
      `Relation "${relationKey}" is already planned on this factory. Remove the duplicate ${methodName}(...) call.`,
    );
  }
}

function canUseForRelation(relation: RuntimeRelationMetadata) {
  return relation.kind === "one" && relation.sourceOwnsForeignKey;
}

function canUseHasOneRelation(relation: RuntimeRelationMetadata) {
  return relation.kind === "one" && !relation.sourceOwnsForeignKey;
}

function canUseHasManyRelation(relation: RuntimeRelationMetadata) {
  return relation.kind === "many";
}

function assertPositiveCount(count: number) {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Expected a non-negative integer count, received ${count}.`);
  }
}

function inferAutoValues<TTable extends Table>(
  table: TTable,
  sequence: number,
  relationOwnedKeys: string[] = [],
) {
  const tableName = tableNameOf(table);
  const values: Record<string, unknown> = {};
  const foreignKeyColumns = new Set(
    getSingleColumnForeignKeys(table).map((foreignKey) => foreignKey.localKey),
  );
  const relationColumns = new Set(relationOwnedKeys);

  for (const [columnKey, column] of Object.entries(getTableColumns(table)) as [string, Column][]) {
    if (foreignKeyColumns.has(columnKey) || relationColumns.has(columnKey)) {
      continue;
    }

    const inferred = inferColumnValue(tableName, columnKey, column, sequence);

    if (inferred !== SKIP_VALUE) {
      values[columnKey] = inferred;
    }
  }

  return values as Partial<InferInsert<TTable>>;
}

function getRelationOwnedColumnKeys(table: Table, relations?: RuntimeRelations) {
  const tableRelations = relations?.bySourceTable.get(table);

  if (!tableRelations) {
    return [];
  }

  return [...tableRelations.values()]
    .filter((relation) => relation.sourceOwnsForeignKey)
    .flatMap((relation) => relation.sourceKeys);
}

function isExistingRow(value: unknown): value is ExistingRow<Table> {
  return Boolean(
    value &&
    typeof value === "object" &&
    EXISTING_ROW in (value as Record<PropertyKey, unknown>) &&
    "row" in (value as Record<PropertyKey, unknown>) &&
    "table" in (value as Record<PropertyKey, unknown>),
  );
}

function isFactoryInstance(value: unknown): value is AutoFactory<Table, FactoryTransient> {
  return Boolean(
    value &&
    typeof value === "object" &&
    FACTORY_INSTANCE in (value as Record<PropertyKey, unknown>),
  );
}

function inferColumnValue(
  tableName: string,
  columnKey: string,
  column: Column,
  sequence: number,
): InferredValue {
  const metadata = column as Column & {
    notNull?: boolean;
    hasDefault?: boolean;
    dataType?: string;
    columnType?: string;
    config?: {
      length?: number;
    };
    enumValues?: string[];
    generated?: { type?: string };
    generatedIdentity?: { type?: string };
  };
  const normalizedName = columnKey.toLowerCase();

  if (metadata.generated?.type || metadata.generatedIdentity?.type) {
    return SKIP_VALUE;
  }

  if (metadata.hasDefault) {
    return SKIP_VALUE;
  }

  if (!metadata.notNull) {
    return SKIP_VALUE;
  }

  const enumValues = metadata.enumValues;
  if (enumValues && enumValues.length > 0) {
    return enumValues[Math.max(0, (sequence - 1) % enumValues.length)] ?? SKIP_VALUE;
  }

  switch (metadata.dataType) {
    case "number":
      return sequence;
    case "bigint":
      return BigInt(sequence);
    case "boolean":
      return false;
    case "json":
      return {};
    case "array":
      return [];
    case "buffer":
      return new Uint8Array();
    case "date":
      return new Date(
        `2026-01-${String(((sequence - 1) % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      );
    case "localDate":
      return `2026-01-${String(((sequence - 1) % 28) + 1).padStart(2, "0")}`;
    case "localDateTime":
      return `2026-01-${String(((sequence - 1) % 28) + 1).padStart(2, "0")}T12:00:00`;
    case "localTime":
      return `12:${String((sequence - 1) % 60).padStart(2, "0")}:00`;
    case "string":
      return inferStringValue(
        tableName,
        normalizedName,
        metadata.columnType,
        metadata.config?.length,
        sequence,
      );
    default:
      return SKIP_VALUE;
  }
}

function inferStringValue(
  tableName: string,
  columnKey: string,
  columnType: string | undefined,
  maxLength: number | undefined,
  sequence: number,
) {
  const applyLength = (value: string) =>
    typeof maxLength === "number" ? value.slice(0, Math.max(0, maxLength)) : value;

  if (columnType === "PgUUID") {
    return applyLength(deterministicUuid(sequence));
  }

  if (columnKey.includes("email")) {
    return applyLength(`${tableName}-${sequence}@example.com`);
  }

  if (columnKey.includes("url")) {
    return applyLength(`https://example.com/${tableName}/${sequence}`);
  }

  if (columnKey.includes("phone")) {
    return applyLength(`+155500${String(sequence).padStart(6, "0")}`);
  }

  if (columnKey.includes("token") || columnKey.includes("nonce")) {
    return applyLength(`${columnKey}-${sequence.toString(36).padStart(8, "0")}`);
  }

  if (columnKey === "id") {
    return applyLength(`${tableName}-${sequence}`);
  }

  if (columnKey.endsWith("id")) {
    return SKIP_VALUE;
  }

  return applyLength(`${tableName}-${columnKey}-${sequence}`);
}

function deterministicUuid(sequence: number) {
  const suffix = sequence.toString(16).padStart(12, "0").slice(-12);
  return `00000000-0000-4000-8000-${suffix}`;
}

function mergeDefined<T extends object>(base: T, patch: Partial<T> | undefined) {
  if (!patch) {
    return { ...base };
  }

  const merged = { ...base } as T & Record<string, unknown>;
  const writable = merged as Record<string, unknown>;

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      writable[key] = value;
    }
  }

  return merged as T;
}

function pruneUndefined<T extends object>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function listMissingRequiredColumns<TTable extends Table>(
  table: TTable,
  values: Partial<InferInsert<TTable>>,
) {
  const missing: string[] = [];

  for (const [columnKey, column] of Object.entries(getTableColumns(table)) as [string, Column][]) {
    const metadata = column as Column & {
      notNull?: boolean;
      hasDefault?: boolean;
      generated?: { type?: string };
      generatedIdentity?: { type?: string };
    };

    if (
      !metadata.notNull ||
      metadata.hasDefault ||
      metadata.generated?.type ||
      metadata.generatedIdentity?.type
    ) {
      continue;
    }

    if (!(columnKey in values)) {
      missing.push(columnKey);
    }
  }

  return missing;
}

function ensureRequiredColumns<TTable extends Table>(
  table: TTable,
  values: Partial<InferInsert<TTable>>,
) {
  const missing = listMissingRequiredColumns(table, values);

  if (missing.length > 0) {
    throw new Error(
      `Could not auto-resolve required columns for "${tableNameOf(table)}": ${missing.join(", ")}. Add overrides or refine the factory with state().`,
    );
  }
}
