import {
  Many,
  One,
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
  normalizeRelation,
  type Relation,
  type Table,
} from "drizzle-orm";

import { columnKeyOf, getForeignKeys, getPrimaryKeyKeys } from "./drizzle-introspection";

export interface RuntimeRelationMetadata {
  key: string;
  kind: "one" | "many";
  sourceOwnsForeignKey: boolean;
  sourceTable: Table;
  sourceKeys: string[];
  targetTable: Table;
  targetKeys: string[];
}

export interface RuntimeRelations {
  bySourceTable: Map<Table, Map<string, RuntimeRelationMetadata>>;
  get(sourceTable: Table, key: string): RuntimeRelationMetadata | undefined;
}

export function extractRuntimeRelations(
  schema: Record<string, unknown>,
): RuntimeRelations | undefined {
  const { tableNamesMap, tables } = extractTablesRelationalConfig(
    schema,
    createTableRelationsHelpers,
  );
  const bySourceTable = new Map<Table, Map<string, RuntimeRelationMetadata>>();

  for (const tableConfig of Object.values(tables)) {
    for (const [key, relation] of Object.entries(tableConfig.relations)) {
      let normalized;

      try {
        normalized = normalizeRelation(tables, tableNamesMap, relation);
      } catch {
        continue;
      }

      const sourceTable = relation.sourceTable;
      const targetTable = relation.referencedTable;
      const sourceKeys = normalized.fields
        .map((column) => columnKeyOf(sourceTable, column))
        .filter((value): value is string => Boolean(value));
      const targetKeys = normalized.references
        .map((column) => columnKeyOf(targetTable, column))
        .filter((value): value is string => Boolean(value));

      if (
        sourceKeys.length !== normalized.fields.length ||
        targetKeys.length !== normalized.references.length
      ) {
        continue;
      }

      const metadata: RuntimeRelationMetadata = {
        key,
        kind: relation instanceof One ? "one" : relation instanceof Many ? "many" : "one",
        sourceOwnsForeignKey: sourceOwnsForeignKey(
          relation,
          sourceTable,
          targetTable,
          sourceKeys,
          targetKeys,
        ),
        sourceTable,
        sourceKeys,
        targetTable,
        targetKeys,
      };
      const tableRelations =
        bySourceTable.get(sourceTable) ?? new Map<string, RuntimeRelationMetadata>();

      tableRelations.set(key, metadata);
      bySourceTable.set(sourceTable, tableRelations);
    }
  }

  if (bySourceTable.size === 0) {
    return undefined;
  }

  return {
    bySourceTable,
    get(sourceTable, key) {
      return bySourceTable.get(sourceTable)?.get(key);
    },
  };
}

function sourceOwnsForeignKey(
  relation: Relation,
  sourceTable: Table,
  targetTable: Table,
  sourceKeys: string[],
  targetKeys: string[],
) {
  if (hasMatchingForeignKey(sourceTable, targetTable, sourceKeys, targetKeys)) {
    return true;
  }

  if (hasMatchingForeignKey(targetTable, sourceTable, targetKeys, sourceKeys)) {
    return false;
  }

  if (relation instanceof Many) {
    return false;
  }

  if (relation instanceof One && relation.config) {
    const sourceKeysArePrimary = matchesKeys(sourceKeys, getPrimaryKeyKeys(sourceTable));
    const targetKeysArePrimary = matchesKeys(targetKeys, getPrimaryKeyKeys(targetTable));

    if (sourceKeysArePrimary && !targetKeysArePrimary) {
      return false;
    }

    return true;
  }

  return false;
}

function hasMatchingForeignKey(
  sourceTable: Table,
  targetTable: Table,
  sourceKeys: string[],
  targetKeys: string[],
) {
  return getForeignKeys(sourceTable).some(
    (foreignKey) =>
      foreignKey.foreignTable === targetTable &&
      matchesKeys(foreignKey.localKeys, sourceKeys) &&
      matchesKeys(foreignKey.foreignKeys, targetKeys),
  );
}

function matchesKeys(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
