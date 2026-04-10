import type { AnyRelation, AnyRelations, Table } from "drizzle-orm";

import { columnKeyOf, getForeignKeys, getPrimaryKeyKeys, isTable } from "./rqb-v2-introspection";
import {
  createRuntimeRelations,
  type RuntimeRelationMetadata,
  type RuntimeRelations,
} from "./runtime-relations";

type RelationsTableEntry = {
  relations: Record<string, AnyRelation>;
  table: Table;
};

export function extractRuntimeRelationsFromRqbV2(
  relations: AnyRelations,
): RuntimeRelations | undefined {
  const metadataEntries: RuntimeRelationMetadata[] = [];

  for (const entry of Object.values(relations)) {
    if (!isRelationsTableEntry(entry)) {
      continue;
    }

    for (const [key, relation] of Object.entries(entry.relations)) {
      if (!isTable(relation.targetTable)) {
        continue;
      }

      const sourceTable = entry.table;
      const targetTable = relation.targetTable;
      const sourceKeys = relation.sourceColumns
        .map((column) => columnKeyOf(sourceTable, column))
        .filter((value): value is string => Boolean(value));
      const targetKeys = relation.targetColumns
        .map((column) => columnKeyOf(targetTable, column))
        .filter((value): value is string => Boolean(value));

      if (
        sourceKeys.length !== relation.sourceColumns.length ||
        targetKeys.length !== relation.targetColumns.length
      ) {
        continue;
      }

      const metadata: RuntimeRelationMetadata = {
        key,
        kind: relation.relationType,
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

      metadataEntries.push(metadata);
    }
  }

  return createRuntimeRelations(metadataEntries);
}

function sourceOwnsForeignKey(
  relation: AnyRelation,
  sourceTable: Table,
  targetTable: Table,
  sourceKeys: string[],
  targetKeys: string[],
) {
  if (relation.through) {
    return false;
  }

  if (hasMatchingForeignKey(sourceTable, targetTable, sourceKeys, targetKeys)) {
    return true;
  }

  if (hasMatchingForeignKey(targetTable, sourceTable, targetKeys, sourceKeys)) {
    return false;
  }

  if (relation.relationType === "many") {
    return false;
  }

  const sourceKeysArePrimary = matchesKeys(sourceKeys, getPrimaryKeyKeys(sourceTable));
  const targetKeysArePrimary = matchesKeys(targetKeys, getPrimaryKeyKeys(targetTable));

  if (sourceKeysArePrimary && !targetKeysArePrimary) {
    return false;
  }

  return true;
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

function isRelationsTableEntry(value: unknown): value is RelationsTableEntry {
  return Boolean(
    value &&
    typeof value === "object" &&
    "table" in value &&
    "relations" in value &&
    isTable((value as { table: unknown }).table),
  );
}
