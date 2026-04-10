import { getTableColumns, type Column, type Table } from "drizzle-orm";
import { SeedService } from "drizzle-seed";
import { getTableConfig as getGelTableConfig } from "drizzle-orm/gel-core";
import { getTableConfig as getMySqlTableConfig } from "drizzle-orm/mysql-core";
import { getTableConfig as getPgTableConfig } from "drizzle-orm/pg-core";
import { getTableConfig as getSingleStoreTableConfig } from "drizzle-orm/singlestore-core";
import { getTableConfig as getSqliteTableConfig } from "drizzle-orm/sqlite-core";

import { getPrimaryKeyKeys, tableNameOf } from "./drizzle-introspection";
import type { FactorySeedGenerator } from "./types";

type SupportedSeedDialect = "mysql" | "postgresql" | "sqlite";
type SeedSelectorColumn = {
  name: string;
  dataType: string;
  columnType: string;
  typeParams: {
    precision?: number;
    scale?: number;
    length?: number;
    dimensions?: number;
  };
  size?: number;
  default?: unknown;
  hasDefault: boolean;
  enumValues?: string[];
  isUnique: boolean;
  notNull: boolean;
  primary: boolean;
  generatedIdentityType?: "always" | "byDefault";
  baseColumn?: Omit<SeedSelectorColumn, "generatedIdentityType">;
};
type SeedSelectorTable = {
  name: string;
  columns: SeedSelectorColumn[];
  primaryKeys: string[];
};
type SeedSelectorMetadata = Column & {
  baseColumn?: SeedSelectorMetadata;
  columnType?: string;
  dataType?: string;
  default?: unknown;
  enumValues?: string[];
  generatedIdentity?: { type?: "always" | "byDefault" };
  getSQLType?: () => string;
  hasDefault?: boolean;
  isUnique?: boolean;
  notNull?: boolean;
  primary?: boolean;
  size?: number;
};
type PreparedSeedSelector = {
  columnByKey: Map<string, SeedSelectorColumn>;
  dialect: SupportedSeedDialect;
  table: SeedSelectorTable;
};

const seedService = new SeedService();
const preparedSelectorCache = new WeakMap<Table, PreparedSeedSelector | null>();

export function selectAutoSeedGenerator(
  table: Table,
  columnKey: string,
): FactorySeedGenerator | undefined {
  const prepared = getPreparedSeedSelector(table);

  if (!prepared) {
    return undefined;
  }

  const column = prepared.columnByKey.get(columnKey);

  if (!column) {
    return undefined;
  }

  switch (prepared.dialect) {
    case "postgresql":
      return seedService.selectGeneratorForPostgresColumn(
        prepared.table as Parameters<typeof seedService.selectGeneratorForPostgresColumn>[0],
        column as Parameters<typeof seedService.selectGeneratorForPostgresColumn>[1],
      ) as FactorySeedGenerator | undefined;
    case "mysql":
      return seedService.selectGeneratorForMysqlColumn(
        prepared.table as Parameters<typeof seedService.selectGeneratorForMysqlColumn>[0],
        column as Parameters<typeof seedService.selectGeneratorForMysqlColumn>[1],
      ) as FactorySeedGenerator | undefined;
    case "sqlite":
      return seedService.selectGeneratorForSqlite(
        prepared.table as Parameters<typeof seedService.selectGeneratorForSqlite>[0],
        column as Parameters<typeof seedService.selectGeneratorForSqlite>[1],
      ) as FactorySeedGenerator | undefined;
  }
}

function getPreparedSeedSelector(table: Table) {
  const cached = preparedSelectorCache.get(table);

  if (cached !== undefined) {
    return cached;
  }

  const dialect = detectSeedDialect(table);

  if (!dialect) {
    preparedSelectorCache.set(table, null);
    return null;
  }

  const prepared: PreparedSeedSelector = {
    columnByKey: new Map(),
    dialect,
    table: {
      columns: [],
      name: tableNameOf(table),
      primaryKeys: getPrimaryKeyKeys(table),
    },
  };

  for (const [columnKey, column] of Object.entries(getTableColumns(table)) as Array<
    [string, Column]
  >) {
    const normalizedColumn = createSeedSelectorColumn(
      columnKey,
      column as SeedSelectorMetadata,
      dialect,
    );
    prepared.table.columns.push(normalizedColumn);
    prepared.columnByKey.set(columnKey, normalizedColumn);
  }

  preparedSelectorCache.set(table, prepared);
  return prepared;
}

function detectSeedDialect(table: Table): SupportedSeedDialect | undefined {
  const getters = [
    {
      dialect: "postgresql" as const,
      getter: getPgTableConfig as (table: unknown) => unknown,
    },
    {
      dialect: "postgresql" as const,
      getter: getGelTableConfig as (table: unknown) => unknown,
    },
    {
      dialect: "mysql" as const,
      getter: getMySqlTableConfig as (table: unknown) => unknown,
    },
    {
      dialect: "mysql" as const,
      getter: getSingleStoreTableConfig as (table: unknown) => unknown,
    },
    {
      dialect: "sqlite" as const,
      getter: getSqliteTableConfig as (table: unknown) => unknown,
    },
  ];

  for (const { dialect, getter } of getters) {
    try {
      getter(table);
      return dialect;
    } catch {
      continue;
    }
  }

  return undefined;
}

function createSeedSelectorColumn(
  columnKey: string,
  column: SeedSelectorMetadata,
  dialect: SupportedSeedDialect,
): SeedSelectorColumn {
  const sqlType = column.getSQLType?.() ?? "";

  return {
    columnType: sqlType,
    dataType: column.dataType ?? "string",
    hasDefault: column.hasDefault ?? false,
    isUnique: column.isUnique ?? false,
    name: columnKey,
    notNull: column.notNull ?? false,
    primary: column.primary ?? false,
    typeParams: parseSeedTypeParams(sqlType, dialect),
    ...(column.baseColumn === undefined
      ? {}
      : {
          baseColumn: omitGeneratedIdentity(
            createSeedSelectorColumn(
              column.baseColumn.name ?? columnKey,
              column.baseColumn,
              dialect,
            ),
          ),
        }),
    ...(column.default === undefined ? {} : { default: column.default }),
    ...(column.enumValues === undefined ? {} : { enumValues: column.enumValues }),
    ...(column.generatedIdentity?.type === undefined
      ? {}
      : { generatedIdentityType: column.generatedIdentity.type }),
    ...(column.size === undefined ? {} : { size: column.size }),
  };
}

function omitGeneratedIdentity(column: SeedSelectorColumn) {
  const { generatedIdentityType: _generatedIdentityType, ...rest } = column;
  return rest;
}

function parseSeedTypeParams(sqlType: string, dialect: SupportedSeedDialect) {
  const typeParams: SeedSelectorColumn["typeParams"] = {};

  if (dialect === "postgresql" && sqlType.includes("[")) {
    const match = sqlType.match(/\[\w*]/g);

    if (match) {
      typeParams.dimensions = match.length;
    }
  }

  const numericPrefixes =
    dialect === "postgresql"
      ? ["numeric", "decimal", "double precision", "real"]
      : dialect === "mysql"
        ? ["decimal", "real", "double", "float", "numeric"]
        : ["decimal"];

  if (numericPrefixes.some((prefix) => sqlType.startsWith(prefix))) {
    const match = sqlType.match(/\((\d+), *(\d+)\)/);

    if (match) {
      typeParams.precision = Number(match[1]);
      typeParams.scale = Number(match[2]);
    }

    return typeParams;
  }

  const lengthPrefixes =
    dialect === "postgresql"
      ? ["varchar", "bpchar", "char", "bit", "time", "timestamp", "interval"]
      : dialect === "mysql"
        ? ["char", "varchar", "binary", "varbinary"]
        : ["char", "varchar", "text"];

  if (lengthPrefixes.some((prefix) => sqlType.startsWith(prefix))) {
    const match = sqlType.match(/\((\d+)\)/);

    if (match) {
      typeParams.length = Number(match[1]);
    }
  }

  return typeParams;
}
