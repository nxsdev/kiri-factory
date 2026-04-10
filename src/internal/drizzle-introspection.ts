import { getTableColumns, type Column, type Table } from "drizzle-orm";
import { getTableConfig as getGelTableConfig } from "drizzle-orm/gel-core";
import { getTableConfig as getMySqlTableConfig } from "drizzle-orm/mysql-core";
import { getTableConfig as getPgTableConfig } from "drizzle-orm/pg-core";
import { getTableConfig as getSingleStoreTableConfig } from "drizzle-orm/singlestore-core";
import { getTableConfig as getSqliteTableConfig } from "drizzle-orm/sqlite-core";

export interface ComplexUniqueConstraint {
  columnKeys: string[];
  kind: "compound" | "expression" | "partial";
  name: string;
  unresolved: boolean;
}

export function isTable(value: unknown): value is Table {
  return Boolean(
    value &&
    typeof value === "object" &&
    getDrizzleSymbolValue(value as Table, "IsDrizzleTable") === true,
  );
}

export function tableNameOf(table: Table) {
  const name = getDrizzleSymbolValue(table, "Name");

  if (typeof name !== "string") {
    throw new Error("Could not read the Drizzle table name from runtime metadata.");
  }

  return name;
}

export function qualifiedTableNameOf(table: Table) {
  const schema = getDrizzleSymbolValue(table, "Schema");
  const name = tableNameOf(table);

  return typeof schema === "string" && schema.length > 0 ? `${schema}.${name}` : name;
}

export function getForeignKeys(table: Table) {
  return getConfiguredForeignKeys(table)
    .map((foreignKey) => foreignKey.reference())
    .map((reference) => ({
      localKeys: reference.columns
        .map((column: Column) => columnKeyOf(table, column))
        .filter((value: string | undefined): value is string => Boolean(value)),
      foreignKeys: reference.foreignColumns
        .map((column: Column) => columnKeyOf(reference.foreignTable as Table, column))
        .filter((value: string | undefined): value is string => Boolean(value)),
      foreignTable: reference.foreignTable as Table,
      localColumnCount: reference.columns.length,
      foreignColumnCount: reference.foreignColumns.length,
    }))
    .filter(
      (value) =>
        value.localKeys.length === value.localColumnCount &&
        value.foreignKeys.length === value.foreignColumnCount,
    )
    .map(({ foreignTable, foreignKeys, localKeys }) => ({
      foreignTable,
      foreignKeys,
      localKeys,
    }));
}

export function getChecks(table: Table) {
  return getTableConfigValue(table, "checks");
}

export function getSingleColumnUniqueKeys(table: Table) {
  const keys = new Set<string>();

  for (const [columnKey, column] of Object.entries(getTableColumns(table)) as [string, Column][]) {
    const metadata = column as Column & { isUnique?: boolean };

    if (metadata.isUnique) {
      keys.add(columnKey);
    }
  }

  for (const uniqueConstraint of getTableConfigValue(table, "uniqueConstraints")) {
    const columns = ((uniqueConstraint as { columns?: Column[] }).columns ?? []) as Column[];

    if (columns.length !== 1) {
      continue;
    }

    const columnKey = columnKeyOf(table, columns[0]!);

    if (columnKey) {
      keys.add(columnKey);
    }
  }

  for (const index of getTableConfigValue(table, "indexes")) {
    const analysis = analyzeUniqueIndex(table, index);

    if (analysis.kind !== "single" || analysis.unresolved || analysis.columnKeys.length !== 1) {
      continue;
    }

    keys.add(analysis.columnKeys[0]!);
  }

  return [...keys];
}

export function getComplexUniqueConstraints(table: Table) {
  const constraints: ComplexUniqueConstraint[] = [];

  for (const uniqueConstraint of getTableConfigValue(table, "uniqueConstraints")) {
    const columns = ((uniqueConstraint as { columns?: Column[] }).columns ?? []) as Column[];

    if (columns.length <= 1) {
      continue;
    }

    const columnKeys = columns
      .map((column) => columnKeyOf(table, column))
      .filter((value): value is string => Boolean(value));

    constraints.push({
      columnKeys: dedupeStrings(columnKeys),
      kind: "compound",
      name: readConstraintName(
        (uniqueConstraint as { name?: unknown }).name,
        "<unnamed unique constraint>",
      ),
      unresolved: columnKeys.length !== columns.length,
    });
  }

  for (const index of getTableConfigValue(table, "indexes")) {
    const analysis = analyzeUniqueIndex(table, index);

    if (analysis.kind === "single") {
      continue;
    }

    constraints.push(analysis);
  }

  return constraints;
}

export function getPrimaryKeyKeys(table: Table) {
  const keys = new Set<string>();

  for (const [columnKey, column] of Object.entries(getTableColumns(table)) as [string, Column][]) {
    const metadata = column as Column & { primary?: boolean };

    if (metadata.primary) {
      keys.add(columnKey);
    }
  }

  for (const primaryKey of getConfiguredPrimaryKeys(table)) {
    const columns = ((primaryKey as { columns?: Column[] }).columns ?? []) as Column[];

    for (const column of columns) {
      const columnKey = columnKeyOf(table, column);

      if (columnKey) {
        keys.add(columnKey);
      }
    }
  }

  return [...keys];
}

function getConfiguredForeignKeys(table: Table) {
  const foreignKeys = getTableConfigValue(table, "foreignKeys") as Array<{
    reference: () => {
      columns: Column[];
      foreignColumns: Column[];
      foreignTable: Table;
    };
  }>;

  return foreignKeys.length > 0 ? foreignKeys : getInlineForeignKeys(table);
}

function getConfiguredPrimaryKeys(table: Table) {
  return getTableConfigValue(table, "primaryKeys") as Array<{
    columns?: Column[];
  }>;
}

function getInlineForeignKeys(table: Table) {
  const symbol = getDrizzleSymbol(table, "InlineForeignKeys");

  if (!symbol) {
    return [] as Array<{
      reference: () => {
        columns: Column[];
        foreignColumns: Column[];
        foreignTable: Table;
      };
    }>;
  }

  return ((table as unknown as Record<symbol, unknown>)[symbol] ?? []) as Array<{
    reference: () => {
      columns: Column[];
      foreignColumns: Column[];
      foreignTable: Table;
    };
  }>;
}

export function columnKeyOf(table: Table, target: Column) {
  const targetName = (target as Column & { name?: unknown }).name;

  for (const [columnKey, column] of Object.entries(getTableColumns(table)) as [string, Column][]) {
    if (column === target) {
      return columnKey;
    }

    if (
      typeof targetName === "string" &&
      (column as Column & { name?: unknown }).name === targetName
    ) {
      return columnKey;
    }
  }

  return undefined;
}

function getDrizzleSymbol(table: Table, hint: string) {
  return Object.getOwnPropertySymbols(table).find((value) => String(value).includes(hint));
}

function getDrizzleSymbolValue(table: Table, hint: string) {
  const symbol = getDrizzleSymbol(table, hint);

  if (!symbol) {
    return undefined;
  }

  return (table as unknown as Record<symbol, unknown>)[symbol];
}

function getTableConfigValue(
  table: Table,
  key: "checks" | "foreignKeys" | "indexes" | "primaryKeys" | "uniqueConstraints",
) {
  const getters: Array<(table: unknown) => Partial<Record<typeof key, unknown>>> = [
    getPgTableConfig as (table: unknown) => Partial<Record<typeof key, unknown>>,
    getGelTableConfig as (table: unknown) => Partial<Record<typeof key, unknown>>,
    getMySqlTableConfig as (table: unknown) => Partial<Record<typeof key, unknown>>,
    getSqliteTableConfig as (table: unknown) => Partial<Record<typeof key, unknown>>,
    getSingleStoreTableConfig as (table: unknown) => Partial<Record<typeof key, unknown>>,
  ];

  const values: unknown[] = [];

  for (const getter of getters) {
    try {
      const config = getter(table);
      const value = config[key];

      if (Array.isArray(value)) {
        values.push(...value);
      }
    } catch {
      continue;
    }
  }

  return values;
}

function analyzeUniqueIndex(
  table: Table,
  index: unknown,
):
  | ComplexUniqueConstraint
  | {
      columnKeys: string[];
      kind: "single";
      name: string;
      unresolved: boolean;
    } {
  const config = (
    index as {
      config?: {
        columns?: unknown[];
        name?: unknown;
        unique?: boolean;
        where?: unknown;
      };
    }
  ).config;

  if (!config?.unique) {
    return {
      columnKeys: [],
      kind: "single" as const,
      name: "<non-unique index>",
      unresolved: false,
    };
  }

  const columnResult = collectReferencedColumnKeys(table, config.columns ?? []);
  const whereResult = collectReferencedColumnKeys(table, config.where);
  const hasExpression = (config.columns ?? []).some(
    (value) => !columnKeyOf(table, value as Column),
  );
  const kind: "compound" | "expression" | "partial" | "single" = config.where
    ? "partial"
    : hasExpression
      ? "expression"
      : columnResult.columnKeys.length > 1
        ? "compound"
        : "single";

  return {
    columnKeys: dedupeStrings([...columnResult.columnKeys, ...whereResult.columnKeys]),
    kind,
    name: readConstraintName(config.name, "<unnamed unique index>"),
    unresolved:
      columnResult.unresolved ||
      whereResult.unresolved ||
      (kind === "single" && columnResult.columnKeys.length !== 1),
  };
}

function collectReferencedColumnKeys(
  table: Table,
  value: unknown,
): {
  columnKeys: string[];
  unresolved: boolean;
} {
  if (value === undefined || value === null) {
    return {
      columnKeys: [],
      unresolved: false,
    };
  }

  if (Array.isArray(value)) {
    return value.reduce(
      (current, entry) => {
        const next = collectReferencedColumnKeys(table, entry);

        return {
          columnKeys: [...current.columnKeys, ...next.columnKeys],
          unresolved: current.unresolved || next.unresolved,
        };
      },
      {
        columnKeys: [] as string[],
        unresolved: false,
      },
    );
  }

  if (typeof value !== "object") {
    return {
      columnKeys: [],
      unresolved: false,
    };
  }

  const directColumnKey = columnKeyOf(table, value as Column);

  if (directColumnKey) {
    return {
      columnKeys: [directColumnKey],
      unresolved: false,
    };
  }

  if ("queryChunks" in value && Array.isArray((value as { queryChunks?: unknown[] }).queryChunks)) {
    const nested = collectReferencedColumnKeys(
      table,
      (value as { queryChunks: unknown[] }).queryChunks,
    );

    return {
      columnKeys: nested.columnKeys,
      unresolved: nested.unresolved || nested.columnKeys.length === 0,
    };
  }

  if ("value" in value && Array.isArray((value as { value?: unknown[] }).value)) {
    return {
      columnKeys: [],
      unresolved: false,
    };
  }

  if ("value" in value && "encoder" in value) {
    return {
      columnKeys: [],
      unresolved: false,
    };
  }

  return {
    columnKeys: [],
    unresolved: true,
  };
}

function dedupeStrings(values: string[]) {
  return [...new Set(values)];
}

function readConstraintName(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}
