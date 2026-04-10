import { getTableColumns, type Column, type Table } from "drizzle-orm";
import { getTableConfig as getGelTableConfig } from "drizzle-orm/gel-core";
import { getTableConfig as getMySqlTableConfig } from "drizzle-orm/mysql-core";
import { getTableConfig as getPgTableConfig } from "drizzle-orm/pg-core";
import { getTableConfig as getSingleStoreTableConfig } from "drizzle-orm/singlestore-core";
import { getTableConfig as getSqliteTableConfig } from "drizzle-orm/sqlite-core";

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

export function getSingleColumnForeignKeys(table: Table) {
  return getForeignKeys(table)
    .filter(
      (foreignKey) => foreignKey.localKeys.length === 1 && foreignKey.foreignKeys.length === 1,
    )
    .map((foreignKey) => ({
      localKey: foreignKey.localKeys[0]!,
      foreignKey: foreignKey.foreignKeys[0]!,
      foreignTable: foreignKey.foreignTable,
    }));
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
  const foreignKeys = getTableConfigValue(table, "foreignKeys");

  return foreignKeys.length > 0 ? foreignKeys : getInlineForeignKeys(table);
}

function getConfiguredPrimaryKeys(table: Table) {
  return getTableConfigValue(table, "primaryKeys");
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

function getTableConfigValue(table: Table, key: "checks" | "foreignKeys" | "primaryKeys") {
  const getters: Array<(table: unknown) => Partial<Record<typeof key, unknown>>> = [
    getPgTableConfig as (table: unknown) => Partial<Record<typeof key, unknown>>,
    getGelTableConfig as (table: unknown) => Partial<Record<typeof key, unknown>>,
    getMySqlTableConfig as (table: unknown) => Partial<Record<typeof key, unknown>>,
    getSqliteTableConfig as (table: unknown) => Partial<Record<typeof key, unknown>>,
    getSingleStoreTableConfig as (table: unknown) => Partial<Record<typeof key, unknown>>,
  ];

  for (const getter of getters) {
    try {
      const config = getter(table);
      const value = config[key];

      if (Array.isArray(value)) {
        return value;
      }
    } catch {
      continue;
    }
  }

  return [];
}
