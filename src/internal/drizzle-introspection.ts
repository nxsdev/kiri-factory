import { getTableColumns, type Column, type Table } from "drizzle-orm";
import { MySqlTable, getTableConfig as getMySqlTableConfig } from "drizzle-orm/mysql-core";
import { PgTable, getTableConfig as getPgTableConfig } from "drizzle-orm/pg-core";
import { SQLiteTable, getTableConfig as getSqliteTableConfig } from "drizzle-orm/sqlite-core";

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
        .map((column) => columnKeyOf(table, column))
        .filter((value): value is string => Boolean(value)),
      foreignKeys: reference.foreignColumns
        .map((column) => columnKeyOf(reference.foreignTable as Table, column))
        .filter((value): value is string => Boolean(value)),
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
  if (table instanceof PgTable) {
    return getPgTableConfig(table).foreignKeys;
  }

  if (table instanceof MySqlTable) {
    return getMySqlTableConfig(table).foreignKeys;
  }

  if (table instanceof SQLiteTable) {
    return getSqliteTableConfig(table).foreignKeys;
  }

  return getInlineForeignKeys(table);
}

function getConfiguredPrimaryKeys(table: Table) {
  if (table instanceof PgTable) {
    return getPgTableConfig(table).primaryKeys;
  }

  if (table instanceof MySqlTable) {
    return getMySqlTableConfig(table).primaryKeys;
  }

  if (table instanceof SQLiteTable) {
    return getSqliteTableConfig(table).primaryKeys;
  }

  return [];
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
  for (const [columnKey, column] of Object.entries(getTableColumns(table)) as [string, Column][]) {
    if (column === target) {
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
