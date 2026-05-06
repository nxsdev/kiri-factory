import {
  getTableColumns,
  type Column,
  type InferInsertModel,
  type InferSelectModel,
  type Table,
} from "drizzle-orm";

import { drizzleReturning } from "./drizzle";
import {
  getChecks,
  getComplexUniqueConstraints,
  getForeignKeys,
  qualifiedTableNameOf,
  tableNameOf,
} from "./drizzle-introspection";
import {
  evaluateAutoSeedGenerator,
  evaluateFactorySeedColumns,
  resolveFactorySeedColumns,
} from "./drizzle-seed-runtime";
import { selectAutoSeedGenerator } from "./drizzle-seed-selector";
import { DEFAULT_FACTORY_SEED, normalizeFactorySeed } from "./seed";
import type { RuntimeRelations } from "./runtime-relations";
import type {
  FactoryAdapter,
  FactoryBinding,
  FactoryInferenceContext,
  FactoryInferenceOptions,
  FactorySeedColumns,
  FactorySeedColumnsInput,
  FactorySeedFunctions,
  FactoryTraitsInput,
} from "./types";

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
type InferInsert<TTable extends Table> = InferInsertModel<TTable>;
type InferSelect<TTable extends Table> = InferSelectModel<TTable>;

type RuntimeBinding<DB = unknown> = FactoryBinding<DB> & {
  inference?: FactoryInferenceOptions<Table>;
  registry?: Map<Table, AutoFactory<Table>>;
  relations?: RuntimeRelations;
  seed: number;
};
type ValueSource = "auto" | "factory" | "override" | "relation";
type ValueSourceMap = Record<string, ValueSource>;

/**
 * Per-call column overrides passed to `build()` and `create()`.
 */
export type FactoryOverrides<TTable extends Table> = Partial<InferInsert<TTable>>;

type InternalState<TTable extends Table> = {
  table: TTable;
  sequence: SequenceTracker;
  columnsInput?: FactorySeedColumnsInput<TTable>;
  traitInputs?: FactoryTraitsInput<TTable>;
  appliedTraits: string[];
  inference: FactoryInferenceOptions<TTable>;
  runtime?: RuntimeBinding;
};

type InferenceMetadata = Column & {
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
  getSQLType?: () => string;
};

type SimpleCheckHints = {
  allowedValues?: Array<boolean | number | string>;
  max?: number;
  maxExclusive?: boolean;
  min?: number;
  minExclusive?: boolean;
  nonEmptyString?: boolean;
};

const simpleCheckCache = new WeakMap<Table, Map<string, SimpleCheckHints>>();
const tableColumnEntriesCache = new WeakMap<Table, Array<[string, Column]>>();
const tableColumnRecordCache = new WeakMap<Table, Record<string, Column>>();
const requiredColumnKeysCache = new WeakMap<Table, string[]>();

type ListOverridesInput<TTable extends Table> =
  | FactoryOverrides<TTable>
  | ((index: number) => FactoryOverrides<TTable>);
type AutoParentRow = Record<string, unknown>;
type AutoParentCache = Map<Table, Map<string, AutoParentRow>>;
type CreateExecution = {
  autoParents: AutoParentCache;
  materializeAutoParents: boolean;
  path: Table[];
};
type SingleColumnForeignKey = {
  foreignKey: string;
  foreignTable: Table;
  localKey: string;
};
type PendingAutoParent = SingleColumnForeignKey;

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
 * `auto values -> columns -> call-site overrides`.
 */
export class AutoFactory<TTable extends Table> {
  readonly [FACTORY_INSTANCE] = true;
  readonly #state: InternalState<TTable>;

  constructor(state: InternalState<TTable>) {
    this.#state = state;
  }

  /**
   * Attaches a database so `create()` can persist rows.
   *
   * When no adapter is supplied, kiri-factory uses Drizzle's `returning()`
   * support by default.
   */
  connect<DB>(
    db: DB,
    options?: { adapter?: FactoryAdapter<DB>; seed?: number },
  ): AutoFactory<TTable>;
  connect<DB>(binding: FactoryBinding<DB>): AutoFactory<TTable>;
  connect<DB>(
    dbOrBinding: DB | FactoryBinding<DB>,
    options?: { adapter?: FactoryAdapter<DB>; seed?: number },
  ) {
    return this.#clone({
      sequence: this.#state.sequence.clone(),
      runtime: normalizeRuntime(
        dbOrBinding,
        options?.adapter,
        this.#state.runtime?.registry,
        this.#state.runtime?.relations,
        this.#state.runtime?.inference,
        options?.seed,
      ),
    });
  }

  /**
   * Returns the shared drizzle-seed column generators for this factory.
   */
  columns(f: FactorySeedFunctions): FactorySeedColumns<TTable> {
    return resolveFactorySeedColumns(this.#state.columnsInput, f);
  }

  /**
   * Named factory variants declared with `defineFactory(..., { traits })`.
   */
  get traits() {
    const traitInputs = this.#state.traitInputs ?? {};
    const traits: Record<string, AutoFactory<TTable>> = {};

    for (const traitName of Object.keys(traitInputs)) {
      Object.defineProperty(traits, traitName, {
        enumerable: true,
        get: () => this.#withTrait(traitName),
      });
    }

    return traits;
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
  async build(overrides: FactoryOverrides<TTable> = {}) {
    return await this.#resolve("build", overrides);
  }

  /**
   * Builds many rows in memory.
   */
  async buildMany(count: number, overrides: ListOverridesInput<TTable> = {}) {
    assertPositiveCount(count);
    const results: InferInsert<TTable>[] = [];

    for (let index = 0; index < count; index += 1) {
      results.push(await this.#resolve("build", resolveListOverrides(overrides, index)));
    }

    return results;
  }

  /**
   * Builds one row and persists it to the configured database.
   */
  async create(overrides: FactoryOverrides<TTable> = {}) {
    return this.#createInternal(overrides, createCreateExecution());
  }

  /**
   * Builds and persists many rows.
   */
  async createMany(count: number, overrides: ListOverridesInput<TTable> = {}) {
    assertPositiveCount(count);
    const results: InferSelect<TTable>[] = [];
    const autoParents = new Map<Table, Map<string, AutoParentRow>>();

    for (let index = 0; index < count; index += 1) {
      results.push(
        await this.#createInternal(resolveListOverrides(overrides, index), {
          autoParents,
          materializeAutoParents: true,
          path: [],
        }),
      );
    }

    return results;
  }

  #clone(overrides: Partial<InternalState<TTable>>) {
    return new AutoFactory<TTable>({
      ...this.#state,
      ...overrides,
    });
  }

  #withTrait(traitName: string) {
    assertUniqueTrait(this.#state.appliedTraits, traitName);

    return this.#clone({
      appliedTraits: [...this.#state.appliedTraits, traitName],
    });
  }

  async #createInternal(overrides: FactoryOverrides<TTable>, execution: CreateExecution) {
    if (!this.#state.runtime) {
      throw new Error(
        `Factory for table "${tableNameOf(this.#state.table)}" is not connected. Call connect(db) before create().`,
      );
    }

    const resolved = await this.#resolve("create", overrides, execution);
    const row = await this.#state.runtime.adapter.create({
      db: this.#state.runtime.db,
      table: this.#state.table,
      values: resolved,
    });

    return row;
  }

  async #resolve(
    strategy: "build" | "create",
    overrides: FactoryOverrides<TTable>,
    execution?: CreateExecution,
  ): Promise<InferInsert<TTable>> {
    const seq = this.#state.sequence.next();
    let values = inferAutoValues(
      this.#state.table,
      seq,
      getRelationOwnedColumnKeys(this.#state.table, this.#state.runtime?.relations),
      this.#state.inference,
      this.#state.runtime?.inference,
      this.#state.runtime?.seed,
    );
    let valueSources = createValueSourceMap(values, "auto");

    values = mergeDefinedWithSource(
      values,
      evaluateFactorySeedColumns(
        this.#state.table,
        this.#state.columnsInput,
        seq,
        this.#state.runtime?.seed ?? DEFAULT_FACTORY_SEED,
      ) as Partial<InferInsert<TTable>>,
      valueSources,
      "factory",
    );

    for (const traitName of this.#state.appliedTraits) {
      values = mergeDefinedWithSource(
        values,
        evaluateFactorySeedColumns(
          this.#state.table,
          this.#state.traitInputs?.[traitName],
          seq,
          this.#state.runtime?.seed ?? DEFAULT_FACTORY_SEED,
        ) as Partial<InferInsert<TTable>>,
        valueSources,
        "factory",
      );
    }

    values = mergeDefinedWithSource(values, overrides, valueSources, "override");
    values = pruneUndefined(values) as Partial<InferInsert<TTable>>;
    valueSources = pruneUndefinedSources(values, valueSources);

    let pendingAutoParents: PendingAutoParent[] = [];

    if (strategy === "create" && execution) {
      ({ pendingAutoParents, valueSources, values } = this.#planAutoParents(
        values,
        valueSources,
        execution,
        seq,
      ));
    }

    ensureRequiredColumns(this.#state.table, values);
    ensureSafeUniqueConstraints(this.#state.table, values, valueSources);
    ensureSimpleChecksSatisfied(
      this.#state.table,
      values,
      this.#state.inference,
      this.#state.runtime?.inference,
    );

    if (
      strategy === "create" &&
      execution &&
      execution.materializeAutoParents &&
      pendingAutoParents.length > 0
    ) {
      ({ valueSources, values } = await this.#materializeAutoParents(
        values,
        valueSources,
        execution,
        pendingAutoParents,
      ));
    }

    return values as InferInsert<TTable>;
  }

  #planAutoParents(
    values: Partial<InferInsert<TTable>>,
    valueSources: ValueSourceMap,
    execution: CreateExecution,
    sequence: number,
  ) {
    if (!this.#state.runtime?.registry) {
      return {
        pendingAutoParents: [] as PendingAutoParent[],
        valueSources,
        values,
      };
    }

    const candidates = getAutoParentCandidates(this.#state.table, values);

    if (candidates.length === 0) {
      return {
        pendingAutoParents: [] as PendingAutoParent[],
        valueSources,
        values,
      };
    }

    const resolved = { ...values };
    const nextSources = { ...valueSources };
    const pendingAutoParents: PendingAutoParent[] = [];

    for (const candidate of candidates) {
      const cachedParent = execution.autoParents.get(this.#state.table)?.get(candidate.localKey);

      if (cachedParent) {
        (resolved as Record<string, unknown>)[candidate.localKey] =
          cachedParent[candidate.foreignKey];
        nextSources[candidate.localKey] = "relation";
        continue;
      }

      const parentFactory = this.#state.runtime.registry.get(candidate.foreignTable);

      if (!parentFactory) {
        continue;
      }

      if (execution.path.includes(candidate.foreignTable)) {
        throw new Error(
          `Could not auto-create "${tableNameOf(candidate.foreignTable)}" for "${tableNameOf(this.#state.table)}" because the foreign-key chain is cyclic. Add explicit overrides or columns(f).`,
        );
      }

      (resolved as Record<string, unknown>)[candidate.localKey] = createAutoParentPlaceholder(
        this.#state.table,
        candidate.localKey,
        sequence,
        this.#state.inference,
        this.#state.runtime?.inference,
        this.#state.runtime?.seed,
      );
      nextSources[candidate.localKey] = "relation";
      pendingAutoParents.push(candidate);
    }

    return {
      pendingAutoParents,
      valueSources: nextSources,
      values: resolved,
    };
  }

  async #materializeAutoParents(
    values: Partial<InferInsert<TTable>>,
    valueSources: ValueSourceMap,
    execution: CreateExecution,
    pendingAutoParents: PendingAutoParent[],
  ) {
    if (!this.#state.runtime?.registry || pendingAutoParents.length === 0) {
      return { valueSources, values };
    }

    for (const candidate of pendingAutoParents) {
      const cachedParent = execution.autoParents.get(this.#state.table)?.get(candidate.localKey);

      if (cachedParent) {
        continue;
      }

      const parentFactory = this.#state.runtime.registry.get(candidate.foreignTable);

      if (!parentFactory) {
        continue;
      }

      await parentFactory.#resolve(
        "create",
        {},
        {
          autoParents: execution.autoParents,
          materializeAutoParents: false,
          path: [...execution.path, this.#state.table],
        },
      );
    }

    const resolved = { ...values };
    const nextSources = { ...valueSources };

    for (const candidate of pendingAutoParents) {
      const cachedParent = execution.autoParents.get(this.#state.table)?.get(candidate.localKey);

      if (cachedParent) {
        (resolved as Record<string, unknown>)[candidate.localKey] =
          cachedParent[candidate.foreignKey];
        nextSources[candidate.localKey] = "relation";
        continue;
      }

      const parentFactory = this.#state.runtime.registry.get(candidate.foreignTable);

      if (!parentFactory) {
        continue;
      }

      const parent = (await parentFactory.#createInternal(
        {},
        {
          autoParents: execution.autoParents,
          materializeAutoParents: true,
          path: [...execution.path, this.#state.table],
        },
      )) as AutoParentRow;
      const foreignKeyValue = parent[candidate.foreignKey];

      if (foreignKeyValue === undefined) {
        throw new Error(
          `Could not auto-create "${tableNameOf(candidate.foreignTable)}" for "${tableNameOf(this.#state.table)}" because "${candidate.foreignKey}" was missing from the parent row returned by the adapter.`,
        );
      }

      cacheAutoParent(execution.autoParents, this.#state.table, candidate.localKey, parent);
      (resolved as Record<string, unknown>)[candidate.localKey] = foreignKeyValue;
      nextSources[candidate.localKey] = "relation";
    }

    return {
      valueSources: nextSources,
      values: resolved,
    };
  }
}

/**
 * Creates a schema-driven factory for one Drizzle table.
 */
export function fromTable<TTable extends Table>(
  table: TTable,
  options: {
    columns?: FactorySeedColumnsInput<TTable>;
    traits?: FactoryTraitsInput<TTable>;
    inference?: FactoryInferenceOptions<TTable>;
  } = {},
) {
  return new AutoFactory<TTable>({
    table,
    sequence: new SequenceTracker(),
    ...(options.columns ? { columnsInput: options.columns } : {}),
    ...(options.traits ? { traitInputs: options.traits } : {}),
    appliedTraits: [],
    inference: options.inference ?? {},
  });
}

function normalizeRuntime<DB>(
  dbOrBinding: DB | FactoryBinding<DB>,
  adapter?: FactoryAdapter<DB>,
  registry?: Map<Table, AutoFactory<Table>>,
  relations?: RuntimeRelations,
  inference?: FactoryInferenceOptions<Table>,
  seed?: number,
): RuntimeBinding<DB> {
  if (isFactoryBinding(dbOrBinding)) {
    return withOptionalRegistry(
      {
        ...dbOrBinding,
        seed: normalizeFactorySeed(dbOrBinding.seed),
      },
      registry ?? (dbOrBinding as RuntimeBinding<DB>).registry,
      relations ?? (dbOrBinding as RuntimeBinding<DB>).relations,
      inference ?? (dbOrBinding as RuntimeBinding<DB>).inference,
      seed ?? (dbOrBinding as RuntimeBinding<DB>).seed,
    );
  }

  return withOptionalRegistry(
    {
      db: dbOrBinding,
      adapter: adapter ?? drizzleReturning<DB>(),
      seed: normalizeFactorySeed(seed),
    },
    registry,
    relations,
    inference,
    seed,
  );
}

function withOptionalRegistry<DB>(
  binding: FactoryBinding<DB>,
  registry?: Map<Table, AutoFactory<Table>>,
  relations?: RuntimeRelations,
  inference?: FactoryInferenceOptions<Table>,
  seed?: number,
) {
  return {
    ...binding,
    inference,
    registry,
    relations,
    seed: normalizeFactorySeed(seed ?? binding.seed),
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

function resolveListOverrides<TTable extends Table>(
  input: ListOverridesInput<TTable>,
  index: number,
) {
  return typeof input === "function" ? input(index) : input;
}

function createCreateExecution(
  autoParents: AutoParentCache = new Map<Table, Map<string, AutoParentRow>>(),
  options: { materializeAutoParents?: boolean } = {},
): CreateExecution {
  return {
    autoParents,
    materializeAutoParents: options.materializeAutoParents ?? true,
    path: [],
  };
}

function cacheAutoParent(
  autoParents: AutoParentCache,
  table: Table,
  localKey: string,
  row: AutoParentRow,
) {
  const entries = autoParents.get(table) ?? new Map<string, AutoParentRow>();
  entries.set(localKey, row);
  autoParents.set(table, entries);
}

function assertUniqueTrait(appliedTraits: string[], traitName: string) {
  if (appliedTraits.includes(traitName)) {
    throw new Error(
      `Trait "${traitName}" is already applied on this factory. Remove the duplicate trait access.`,
    );
  }
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
  inference: FactoryInferenceOptions<TTable> = {},
  runtimeInference?: FactoryInferenceOptions<Table>,
  seed = DEFAULT_FACTORY_SEED,
) {
  const tableName = qualifiedTableNameOf(table);
  const values: Record<string, unknown> = {};
  const foreignKeyColumns = new Set(
    getForeignKeys(table).flatMap((foreignKey) => foreignKey.localKeys),
  );
  const relationColumns = new Set(relationOwnedKeys);

  for (const [columnKey, column] of getTableColumnEntries(table)) {
    if (foreignKeyColumns.has(columnKey) || relationColumns.has(columnKey)) {
      continue;
    }

    const inferred = inferColumnValue(
      table,
      tableName,
      columnKey,
      column,
      sequence,
      inference,
      runtimeInference,
      seed,
    );

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

function getSingleColumnForeignKeys(table: Table) {
  return getForeignKeys(table)
    .filter(
      (foreignKey) => foreignKey.localKeys.length === 1 && foreignKey.foreignKeys.length === 1,
    )
    .map((foreignKey) => ({
      foreignKey: foreignKey.foreignKeys[0]!,
      foreignTable: foreignKey.foreignTable,
      localKey: foreignKey.localKeys[0]!,
    })) satisfies SingleColumnForeignKey[];
}

function getAutoParentCandidates<TTable extends Table>(
  table: TTable,
  values: Partial<InferInsert<TTable>>,
) {
  const missing = new Set(listMissingRequiredColumns(table, values));
  return getSingleColumnForeignKeys(table).filter((foreignKey) => missing.has(foreignKey.localKey));
}

function createAutoParentPlaceholder<TTable extends Table>(
  table: TTable,
  columnKey: string,
  sequence: number,
  inference: FactoryInferenceOptions<TTable>,
  runtimeInference?: FactoryInferenceOptions<Table>,
  seed = DEFAULT_FACTORY_SEED,
) {
  const column = getTableColumnRecord(table)[columnKey];

  if (!column) {
    return sequence;
  }

  const inferred = inferColumnValue(
    table,
    qualifiedTableNameOf(table),
    columnKey,
    column,
    sequence,
    inference,
    runtimeInference,
    seed,
  );

  if (inferred !== SKIP_VALUE) {
    return inferred;
  }

  const metadata = column as InferenceMetadata;

  if (metadata.dataType === "string") {
    return `kiri-factory-parent-${sequence}`;
  }

  if (metadata.dataType === "date") {
    return new Date(sequence);
  }

  if (metadata.dataType === "bigint") {
    return BigInt(sequence);
  }

  return sequence;
}

function inferColumnValue<TTable extends Table>(
  table: TTable,
  tableName: string,
  columnKey: string,
  column: Column,
  sequence: number,
  inference: FactoryInferenceOptions<TTable>,
  runtimeInference?: FactoryInferenceOptions<Table>,
  seed = DEFAULT_FACTORY_SEED,
): InferredValue {
  const metadata = column as InferenceMetadata;
  const sqlType = getColumnSqlType(column);
  const context = {
    column,
    columnKey,
    columnType: metadata.columnType,
    dataType: metadata.dataType,
    sequence,
    sqlType,
    table,
    tableName,
  } satisfies FactoryInferenceContext<Table>;

  if (metadata.generated?.type || metadata.generatedIdentity?.type) {
    return SKIP_VALUE;
  }

  if (metadata.hasDefault) {
    return SKIP_VALUE;
  }

  if (!metadata.notNull) {
    return SKIP_VALUE;
  }

  const explicit = resolveExplicitInference(context, inference, runtimeInference);

  if (explicit !== undefined) {
    return explicit as InferredValue;
  }

  const selectedGenerator = selectAutoSeedGenerator(table, columnKey);

  if (!selectedGenerator) {
    return SKIP_VALUE;
  }

  return (evaluateAutoSeedGenerator(table, columnKey, column, selectedGenerator, sequence, seed) ??
    SKIP_VALUE) as InferredValue;
}

function resolveExplicitInference<TTable extends Table>(
  context: FactoryInferenceContext<TTable>,
  inference: FactoryInferenceOptions<TTable>,
  runtimeInference?: FactoryInferenceOptions<Table>,
) {
  const columnKeys = [qualifyColumnKey(context.tableName, context.columnKey), context.columnKey];

  for (const key of columnKeys) {
    const resolver = inference.columns?.[key] ?? runtimeInference?.columns?.[key];
    const value = resolver?.(context);

    if (value !== undefined) {
      return value;
    }
  }

  if (context.dataType !== "custom") {
    return undefined;
  }

  const sqlType = context.sqlType;
  const normalizedSqlType = normalizeSqlType(sqlType);
  const customKeys = [sqlType, normalizedSqlType, context.columnType].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  for (const key of customKeys) {
    const resolver = inference.customTypes?.[key] ?? runtimeInference?.customTypes?.[key];
    const value = resolver?.(context);

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function getSimpleCheckHints(table: Table) {
  const cached = simpleCheckCache.get(table);

  if (cached) {
    return cached;
  }

  const byColumn = new Map<string, SimpleCheckHints>();

  for (const check of getChecks(table)) {
    const parsed = parseSimpleCheck(table, check as { value?: unknown });

    if (!parsed) {
      continue;
    }

    const current = byColumn.get(parsed.columnKey);
    byColumn.set(parsed.columnKey, mergeCheckHints(current, parsed.hints));
  }

  simpleCheckCache.set(table, byColumn);
  return byColumn;
}

function parseSimpleCheck(table: Table, check: { value?: unknown }) {
  const expression = renderSimpleCheckExpression(table, check.value);

  if (!expression) {
    return undefined;
  }

  const normalized = expression.replace(/\s+/g, " ").trim();
  const rangeMatch =
    /^(__kfcol\{[^}]+\}__)\s*(>=|>)\s*(.+)\s+AND\s+\1\s*(<=|<)\s*(.+)$/i.exec(normalized) ??
    /^(__kfcol\{[^}]+\}__)\s*(<=|<)\s*(.+)\s+AND\s+\1\s*(>=|>)\s*(.+)$/i.exec(normalized);

  if (rangeMatch) {
    const columnKey = extractCheckColumnKey(rangeMatch[1]!);
    const lowerFirst = rangeMatch[2] === ">" || rangeMatch[2] === ">=";
    const lowerOperator = lowerFirst ? rangeMatch[2]! : rangeMatch[4]!;
    const upperOperator = lowerFirst ? rangeMatch[4]! : rangeMatch[2]!;
    const lower = parseCheckLiteral(lowerFirst ? rangeMatch[3]! : rangeMatch[5]!);
    const upper = parseCheckLiteral(lowerFirst ? rangeMatch[5]! : rangeMatch[3]!);

    if (columnKey && typeof lower === "number" && typeof upper === "number") {
      return {
        columnKey,
        hints: mergeCheckHints(
          { min: lower, minExclusive: lowerOperator === ">" },
          { max: upper, maxExclusive: upperOperator === "<" },
        ),
      };
    }
  }

  const betweenMatch = /^(__kfcol\{[^}]+\}__)\s+BETWEEN\s+(.+)\s+AND\s+(.+)$/i.exec(normalized);

  if (betweenMatch) {
    const columnKey = extractCheckColumnKey(betweenMatch[1]!);
    const lower = parseCheckLiteral(betweenMatch[2]!);
    const upper = parseCheckLiteral(betweenMatch[3]!);

    if (columnKey && typeof lower === "number" && typeof upper === "number") {
      return {
        columnKey,
        hints: { max: upper, min: lower },
      };
    }
  }

  const comparisonMatch = /^(__kfcol\{[^}]+\}__)\s*(<=|>=|<|>)\s*(.+)$/i.exec(normalized);

  if (comparisonMatch) {
    const columnKey = extractCheckColumnKey(comparisonMatch[1]!);
    const value = parseCheckLiteral(comparisonMatch[3]!);

    if (columnKey && typeof value === "number") {
      return {
        columnKey,
        hints:
          comparisonMatch[2] === ">"
            ? { min: value, minExclusive: true }
            : comparisonMatch[2] === ">="
              ? { min: value }
              : comparisonMatch[2] === "<"
                ? { max: value, maxExclusive: true }
                : { max: value },
      };
    }
  }

  const inMatch = /^(__kfcol\{[^}]+\}__)\s+IN\s*\((.+)\)$/i.exec(normalized);

  if (inMatch) {
    const columnKey = extractCheckColumnKey(inMatch[1]!);
    const values = splitCheckList(inMatch[2]!)
      .map(parseCheckLiteral)
      .filter((value): value is boolean | number | string => value !== undefined);

    if (columnKey && values.length > 0) {
      return {
        columnKey,
        hints: { allowedValues: values },
      };
    }
  }

  const nonEmptyMatch =
    /^(?:btrim\()?(?:__kfcol\{[^}]+\}__)(?:\))?\s*(?:<>|!=)\s*''$/i.exec(normalized) ??
    /^''\s*(?:<>|!=)\s*(?:btrim\()?(?:__kfcol\{[^}]+\}__)(?:\))?$/i.exec(normalized);

  if (nonEmptyMatch) {
    const columnKeyMatch = /(__kfcol\{[^}]+\}__)/.exec(normalized);
    const columnKey = columnKeyMatch ? extractCheckColumnKey(columnKeyMatch[1]!) : undefined;

    if (columnKey) {
      return {
        columnKey,
        hints: { nonEmptyString: true },
      };
    }
  }

  return undefined;
}

function renderSimpleCheckExpression(table: Table, value: unknown): string | undefined {
  return renderCheckChunk(table, value as { queryChunks?: unknown[] });
}

function renderCheckChunk(table: Table, chunk: unknown): string | undefined {
  if (chunk === undefined) {
    return "";
  }

  if (typeof chunk === "string") {
    return chunk;
  }

  if (Array.isArray(chunk)) {
    const parts = chunk
      .map((value) => renderCheckChunk(table, value))
      .filter((value): value is string => value !== undefined);

    return parts.join("");
  }

  if (typeof chunk !== "object" || chunk === null) {
    return renderCheckLiteral(chunk);
  }

  if ("queryChunks" in chunk && Array.isArray((chunk as { queryChunks?: unknown[] }).queryChunks)) {
    return renderCheckChunk(table, (chunk as { queryChunks: unknown[] }).queryChunks);
  }

  if ("value" in chunk && Array.isArray((chunk as { value?: string[] }).value)) {
    return (chunk as { value: string[] }).value.join("");
  }

  const columnKey = columnKeyFromCheckChunk(table, chunk);

  if (columnKey) {
    return qualifyCheckColumnMarker(columnKey);
  }

  if ("value" in chunk && "encoder" in chunk) {
    return renderCheckLiteral((chunk as { value: unknown }).value);
  }

  return undefined;
}

function columnKeyFromCheckChunk(table: Table, chunk: unknown) {
  if (typeof chunk !== "object" || chunk === null) {
    return undefined;
  }

  const candidateName = "name" in chunk ? (chunk as { name?: unknown }).name : undefined;

  if (typeof candidateName !== "string") {
    return undefined;
  }

  for (const [columnKey, column] of getTableColumnEntries(table)) {
    if ((column as { name?: string }).name === candidateName) {
      return columnKey;
    }
  }

  return undefined;
}

function renderCheckLiteral(value: unknown) {
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "string") {
    return `'${value.replaceAll("'", "''")}'`;
  }

  return undefined;
}

function parseCheckLiteral(raw: string) {
  const value = raw.trim();

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }

  if (/^(true|false)$/i.test(value)) {
    return value.toLowerCase() === "true";
  }

  const stringMatch = /^'(.*)'$/s.exec(value) ?? /^"(.*)"$/s.exec(value);

  if (stringMatch) {
    return stringMatch[1]!.replaceAll("''", "'");
  }

  return undefined;
}

function splitCheckList(raw: string) {
  const result: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;

  for (const character of raw) {
    if (quote) {
      current += character;

      if (character === quote) {
        quote = undefined;
      }

      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      current += character;
      continue;
    }

    if (character === ",") {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim().length > 0) {
    result.push(current.trim());
  }

  return result;
}

function mergeCheckHints(
  current: SimpleCheckHints | undefined,
  next: SimpleCheckHints,
): SimpleCheckHints {
  const merged: SimpleCheckHints = {
    ...current,
    ...next,
  };

  if (current?.nonEmptyString || next.nonEmptyString) {
    merged.nonEmptyString = true;
  }

  if (current?.min !== undefined && next.min !== undefined) {
    if (next.min > current.min) {
      merged.min = next.min;
      if (next.minExclusive !== undefined) {
        merged.minExclusive = next.minExclusive;
      } else {
        delete merged.minExclusive;
      }
    } else if (next.min === current.min) {
      const minExclusive = current.minExclusive || next.minExclusive;

      if (minExclusive !== undefined) {
        merged.minExclusive = minExclusive;
      } else {
        delete merged.minExclusive;
      }
    } else {
      merged.min = current.min;
      if (current.minExclusive !== undefined) {
        merged.minExclusive = current.minExclusive;
      } else {
        delete merged.minExclusive;
      }
    }
  }

  if (current?.max !== undefined && next.max !== undefined) {
    if (next.max < current.max) {
      merged.max = next.max;
      if (next.maxExclusive !== undefined) {
        merged.maxExclusive = next.maxExclusive;
      } else {
        delete merged.maxExclusive;
      }
    } else if (next.max === current.max) {
      const maxExclusive = current.maxExclusive || next.maxExclusive;

      if (maxExclusive !== undefined) {
        merged.maxExclusive = maxExclusive;
      } else {
        delete merged.maxExclusive;
      }
    } else {
      merged.max = current.max;
      if (current.maxExclusive !== undefined) {
        merged.maxExclusive = current.maxExclusive;
      } else {
        delete merged.maxExclusive;
      }
    }
  }

  if (current?.allowedValues && next.allowedValues) {
    const nextSet = new Set(next.allowedValues.map((value) => JSON.stringify(value)));
    merged.allowedValues = current.allowedValues.filter((value) =>
      nextSet.has(JSON.stringify(value)),
    );
  }

  return merged;
}

function qualifyColumnKey(tableName: string, columnKey: string) {
  return `${tableName}.${columnKey}`;
}

function qualifyCheckColumnMarker(columnKey: string) {
  return `__kfcol{${columnKey}}__`;
}

function extractCheckColumnKey(marker: string) {
  const match = /^__kfcol\{([^}]+)\}__$/.exec(marker);
  return match?.[1];
}

function normalizeSqlType(sqlType: string) {
  return sqlType.replace(/\s*\(.*\)\s*$/, "");
}

function getColumnSqlType(column: Column) {
  try {
    return (column as InferenceMetadata).getSQLType?.() ?? "";
  } catch {
    return "";
  }
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

function mergeDefinedWithSource<T extends object>(
  base: T,
  patch: Partial<T> | undefined,
  sources: ValueSourceMap,
  source: ValueSource,
) {
  const merged = mergeDefined(base, patch);

  if (!patch) {
    return merged;
  }

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      sources[key] = source;
    }
  }

  return merged;
}

function pruneUndefined<T extends object>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function createValueSourceMap<T extends object>(value: T, source: ValueSource) {
  return Object.fromEntries(Object.entries(value).map(([key]) => [key, source])) as ValueSourceMap;
}

function pruneUndefinedSources<T extends object>(values: T, sources: ValueSourceMap) {
  const activeKeys = new Set(Object.keys(values));
  const nextSources = { ...sources };

  for (const key of Object.keys(nextSources)) {
    if (!activeKeys.has(key)) {
      delete nextSources[key];
    }
  }

  return nextSources;
}

function listMissingRequiredColumns<TTable extends Table>(
  table: TTable,
  values: Partial<InferInsert<TTable>>,
) {
  return getRequiredColumnKeys(table).filter((columnKey) => !(columnKey in values));
}

function ensureRequiredColumns<TTable extends Table>(
  table: TTable,
  values: Partial<InferInsert<TTable>>,
) {
  const missing = listMissingRequiredColumns(table, values);

  if (missing.length > 0) {
    throw new Error(
      `Could not auto-resolve required columns for "${tableNameOf(table)}": ${missing.join(", ")}. ${buildMissingColumnHint(table, missing)}`,
    );
  }
}

function ensureSafeUniqueConstraints<TTable extends Table>(
  table: TTable,
  values: Partial<InferInsert<TTable>>,
  valueSources: ValueSourceMap,
) {
  for (const constraint of getComplexUniqueConstraints(table)) {
    const relatedColumnKeys = constraint.columnKeys.filter((columnKey) => columnKey in values);

    if (constraint.unresolved) {
      throw new Error(
        `Could not safely auto-resolve "${tableNameOf(table)}" because ${describeUniqueConstraint(constraint)} could not be fully analyzed. Set the constrained values explicitly and confirm them with verifyCreates() against a disposable database.`,
      );
    }

    if (relatedColumnKeys.length === 0) {
      continue;
    }

    const autoGeneratedColumnKeys = relatedColumnKeys.filter(
      (columnKey) => valueSources[columnKey] === "auto",
    );

    if (autoGeneratedColumnKeys.length > 0) {
      throw new Error(
        `Could not safely auto-resolve "${tableNameOf(table)}" because ${describeUniqueConstraint(constraint)} still relies on auto-generated values for: ${autoGeneratedColumnKeys.join(", ")}. Provide explicit values through columns(f) or call-site overrides.`,
      );
    }
  }
}

function ensureSimpleChecksSatisfied<TTable extends Table>(
  table: TTable,
  values: Partial<InferInsert<TTable>>,
  inference: FactoryInferenceOptions<TTable>,
  runtimeInference?: FactoryInferenceOptions<Table>,
) {
  const checksEnabled = inference.checks ?? runtimeInference?.checks ?? true;

  if (!checksEnabled) {
    return;
  }

  for (const [columnKey, hints] of getSimpleCheckHints(table)) {
    if (!(columnKey in values)) {
      continue;
    }

    const value = (values as Record<string, unknown>)[columnKey];

    if (value === undefined || checkHintAllowsValue(hints, value)) {
      continue;
    }

    throw new Error(
      `Generated value for "${tableNameOf(table)}.${columnKey}" does not satisfy a simple CHECK constraint. Provide an explicit value through columns(f), an inference resolver, or a call-site override.`,
    );
  }
}

function checkHintAllowsValue(hints: SimpleCheckHints, value: unknown) {
  if (hints.allowedValues && hints.allowedValues.length > 0) {
    return hints.allowedValues.some((candidate) => candidate === value);
  }

  if (hints.nonEmptyString && typeof value === "string" && value.trim().length === 0) {
    return false;
  }

  if (typeof value === "number") {
    if (hints.min !== undefined) {
      if (hints.minExclusive ? value <= hints.min : value < hints.min) {
        return false;
      }
    }

    if (hints.max !== undefined) {
      if (hints.maxExclusive ? value >= hints.max : value > hints.max) {
        return false;
      }
    }
  }

  return true;
}

function buildMissingColumnHint<TTable extends Table>(table: TTable, missing: string[]) {
  const columns = getTableColumnRecord(table);
  const hints: string[] = [];
  const compositeForeignKeyColumns = new Set(
    getForeignKeys(table)
      .filter((foreignKey) => foreignKey.localKeys.length > 1)
      .flatMap((foreignKey) => foreignKey.localKeys),
  );
  const singleForeignKeyColumns = new Set(
    getForeignKeys(table)
      .filter((foreignKey) => foreignKey.localKeys.length === 1)
      .flatMap((foreignKey) => foreignKey.localKeys),
  );
  const missingSingleForeignKeys = missing.filter((columnKey) =>
    singleForeignKeyColumns.has(columnKey),
  );

  if (missing.some((columnKey) => compositeForeignKeyColumns.has(columnKey))) {
    hints.push(
      "Composite foreign keys are never auto-created. Provide direct overrides for the full key.",
    );
  }

  if (missingSingleForeignKeys.length > 0) {
    hints.push(
      "Single-column foreign keys can be auto-created during create()/createMany() when their parent tables are available in the runtime. Use direct overrides for build(), cycles, or unresolved parents.",
    );
  }

  if (
    missing.some((columnKey) => {
      const metadata = columns[columnKey] as InferenceMetadata | undefined;
      return metadata?.dataType === "custom";
    })
  ) {
    hints.push(
      "customType(...) columns need an inference resolver, columns(f), or explicit overrides.",
    );
  }

  hints.push("Add overrides or refine the factory with columns(f).");

  return hints.join(" ");
}

function describeUniqueConstraint(constraint: {
  kind: "compound" | "expression" | "partial";
  name: string;
}) {
  const kindLabel =
    constraint.kind === "compound"
      ? "compound unique constraint"
      : constraint.kind === "partial"
        ? "partial unique index"
        : "expression-based unique index";

  return `${kindLabel} "${constraint.name}"`;
}

function getTableColumnEntries(table: Table) {
  const cached = tableColumnEntriesCache.get(table);

  if (cached) {
    return cached;
  }

  const entries = Object.entries(getTableColumns(table)) as Array<[string, Column]>;
  tableColumnEntriesCache.set(table, entries);
  return entries;
}

function getTableColumnRecord(table: Table) {
  const cached = tableColumnRecordCache.get(table);

  if (cached) {
    return cached;
  }

  const record = Object.fromEntries(getTableColumnEntries(table)) as Record<string, Column>;
  tableColumnRecordCache.set(table, record);
  return record;
}

function getRequiredColumnKeys(table: Table) {
  const cached = requiredColumnKeysCache.get(table);

  if (cached) {
    return cached;
  }

  const keys = getTableColumnEntries(table)
    .filter(([, column]) => {
      const metadata = column as Column & {
        notNull?: boolean;
        hasDefault?: boolean;
        generated?: { type?: string };
        generatedIdentity?: { type?: string };
      };

      return !(
        !metadata.notNull ||
        metadata.hasDefault ||
        metadata.generated?.type ||
        metadata.generatedIdentity?.type
      );
    })
    .map(([columnKey]) => columnKey);

  requiredColumnKeysCache.set(table, keys);
  return keys;
}
