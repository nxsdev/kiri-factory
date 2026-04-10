import type { Table } from "drizzle-orm";

export interface RuntimeRelationThroughMetadata {
  table: Table;
  sourceKeys: string[];
  targetKeys: string[];
}

export interface RuntimeRelationMetadata {
  key: string;
  kind: "one" | "many";
  sourceOwnsForeignKey: boolean;
  sourceTable: Table;
  sourceKeys: string[];
  targetTable: Table;
  targetKeys: string[];
  through?: RuntimeRelationThroughMetadata;
}

export interface RuntimeRelations {
  bySourceTable: Map<Table, Map<string, RuntimeRelationMetadata>>;
  get(sourceTable: Table, key: string): RuntimeRelationMetadata | undefined;
}

export function createRuntimeRelations(
  entries: Iterable<RuntimeRelationMetadata>,
): RuntimeRelations | undefined {
  const bySourceTable = new Map<Table, Map<string, RuntimeRelationMetadata>>();

  for (const entry of entries) {
    const relationsForTable =
      bySourceTable.get(entry.sourceTable) ?? new Map<string, RuntimeRelationMetadata>();

    relationsForTable.set(entry.key, entry);
    bySourceTable.set(entry.sourceTable, relationsForTable);
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
