import type { Table } from "drizzle-orm";

import type { ManyToManyBridge } from "../bridges";
import { tableNameOf } from "./drizzle-introspection";
import {
  createRuntimeRelations,
  type RuntimeRelationMetadata,
  type RuntimeRelations,
} from "./runtime-relations";

type TableMap = Record<string, Table>;
type ManyToManyBridgeMap = Partial<
  Record<string, Record<string, ManyToManyBridge<Table, string, string>>>
>;

export function extractBridgeRuntimeRelations(
  tables: TableMap,
  bridges: ManyToManyBridgeMap | undefined,
  runtimeRelations: RuntimeRelations | undefined,
) {
  if (!bridges || !runtimeRelations) {
    return undefined;
  }

  const entries: RuntimeRelationMetadata[] = [];

  for (const [sourceKey, sourceBridges] of Object.entries(bridges)) {
    const sourceTable = tables[sourceKey];

    if (!sourceTable) {
      throw new Error(
        `Unknown bridge source "${sourceKey}". Add the matching table to createFactories({ tables | schema }).`,
      );
    }

    for (const [relationKey, bridge] of Object.entries(sourceBridges ?? {})) {
      const sourceRelation = runtimeRelations.get(bridge.through, bridge.source);
      const targetRelation = runtimeRelations.get(bridge.through, bridge.target);

      if (!sourceRelation) {
        throw new Error(
          `Bridge "${sourceKey}.${relationKey}" could not find relation "${bridge.source}" on through table "${tableNameOf(bridge.through)}".`,
        );
      }

      if (!targetRelation) {
        throw new Error(
          `Bridge "${sourceKey}.${relationKey}" could not find relation "${bridge.target}" on through table "${tableNameOf(bridge.through)}".`,
        );
      }

      if (sourceRelation.kind !== "one" || targetRelation.kind !== "one") {
        throw new Error(
          `Bridge "${sourceKey}.${relationKey}" requires one-to-one edges from the through table "${tableNameOf(bridge.through)}".`,
        );
      }

      if (sourceRelation.targetTable !== sourceTable) {
        throw new Error(
          `Bridge "${sourceKey}.${relationKey}" expected "${bridge.source}" on "${tableNameOf(bridge.through)}" to point at "${tableNameOf(sourceTable)}".`,
        );
      }

      entries.push({
        key: relationKey,
        kind: "many",
        sourceOwnsForeignKey: false,
        sourceTable,
        sourceKeys: sourceRelation.targetKeys,
        targetTable: targetRelation.targetTable,
        targetKeys: targetRelation.targetKeys,
        through: {
          table: bridge.through,
          sourceKeys: sourceRelation.sourceKeys,
          targetKeys: targetRelation.sourceKeys,
        },
      });
    }
  }

  return createRuntimeRelations(entries);
}

export function mergeRuntimeRelations(...relations: Array<RuntimeRelations | undefined>) {
  const entries: RuntimeRelationMetadata[] = [];

  for (const relationSet of relations) {
    if (!relationSet) {
      continue;
    }

    for (const sourceRelations of relationSet.bySourceTable.values()) {
      entries.push(...sourceRelations.values());
    }
  }

  return createRuntimeRelations(entries);
}
