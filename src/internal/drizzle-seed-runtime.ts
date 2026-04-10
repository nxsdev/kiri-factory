import { getGeneratorsFunctions } from "drizzle-seed";
import { getTableColumns, type Column, type Table } from "drizzle-orm";

import { getSingleColumnUniqueKeys, qualifiedTableNameOf } from "./drizzle-introspection";
import type { FactorySeedColumns, FactorySeedColumnsInput, FactorySeedGenerator } from "./types";

type SeedColumnMetadata = Column & {
  config?: {
    length?: number;
  };
  dataType?: string;
};

type MutableFactorySeedGenerator = FactorySeedGenerator & {
  baseColumnDataType?: string | undefined;
  dataType?: string | undefined;
  isUnique?: boolean | undefined;
  notNull?: boolean | undefined;
  stringLength?: number | undefined;
  init(args: {
    count: number | Array<{ weight: number; count: number | number[] }>;
    seed: number;
  }): void;
  generate(args: { i: number }): unknown;
  replaceIfArray?: () => MutableFactorySeedGenerator | undefined;
  replaceIfUnique?: () => MutableFactorySeedGenerator | undefined;
};

export function evaluateFactorySeedColumns<TTable extends Table>(
  table: TTable,
  columnsInput: FactorySeedColumnsInput<TTable> | undefined,
  sequence: number,
) {
  if (!columnsInput) {
    return {} as Partial<Record<keyof FactorySeedColumns<TTable>, unknown>>;
  }

  const generatedColumns = columnsInput(getGeneratorsFunctions());
  const tableColumns = getTableColumns(table) as Record<string, SeedColumnMetadata>;
  const singleColumnUniqueKeys = new Set(getSingleColumnUniqueKeys(table));
  const resolved = {} as Partial<Record<keyof FactorySeedColumns<TTable>, unknown>>;

  for (const [columnKey, generator] of Object.entries(generatedColumns) as Array<
    [keyof FactorySeedColumns<TTable> & string, FactorySeedGenerator | undefined]
  >) {
    if (!generator) {
      continue;
    }

    const column = tableColumns[columnKey];

    if (!column) {
      throw new Error(
        `columns(f) returned "${columnKey}" for "${qualifiedTableNameOf(table)}", but that column does not exist on the table.`,
      );
    }

    const prepared = prepareFactorySeedGenerator(
      table,
      columnKey,
      column,
      generator,
      sequence,
      singleColumnUniqueKeys.has(columnKey),
    );
    let value: unknown;

    for (let index = 0; index < sequence; index += 1) {
      value = prepared.generate({ i: index });
    }

    if (value !== undefined) {
      resolved[columnKey] = value;
    }
  }

  return resolved;
}

function prepareFactorySeedGenerator(
  table: Table,
  columnKey: string,
  column: SeedColumnMetadata,
  generator: FactorySeedGenerator,
  sequence: number,
  isUniqueColumn: boolean,
) {
  let current = generator as MutableFactorySeedGenerator;
  const wasUniqueByDefault = current.isUnique === true;

  const arrayGenerator = current.replaceIfArray?.();

  if (arrayGenerator) {
    current = arrayGenerator as unknown as MutableFactorySeedGenerator;
  }

  current.isUnique = isUniqueColumn;

  const uniqueGenerator = current.replaceIfUnique?.();

  if (uniqueGenerator) {
    current = uniqueGenerator as MutableFactorySeedGenerator;
  }

  if (isUniqueColumn && !wasUniqueByDefault && !uniqueGenerator) {
    throw new Error(
      `Column "${qualifiedTableNameOf(table)}.${columnKey}" is unique, but columns(f) did not provide a unique-safe drizzle-seed generator. Use a generator with { isUnique: true } or one that supports replaceIfUnique().`,
    );
  }

  const notNull = (column as { notNull?: boolean }).notNull;

  if (notNull !== undefined) {
    current.notNull = notNull;
  }

  if (column.dataType !== undefined) {
    current.dataType = column.dataType;
  }

  if (column.config?.length !== undefined) {
    current.stringLength = column.config.length;
  }

  current.init({
    count: sequence,
    seed: stableColumnSeed(qualifiedTableNameOf(table), columnKey),
  });

  return current;
}

function stableColumnSeed(tableName: string, columnKey: string) {
  const text = `${tableName}.${columnKey}`;
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) + 1;
}
