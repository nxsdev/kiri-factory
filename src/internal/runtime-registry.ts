import type { Table } from "drizzle-orm";

import { FACTORY_INSTANCE, fromTable, type AutoFactory } from "./core";
import type { FactoryDefinition } from "./define";
import type { FactoryBinding, FactoryInferenceOptions } from "./types";
import { tableNameOf } from "./drizzle-introspection";
import type { RuntimeRelations } from "./runtime-relations";

type TableMap = Record<string, Table>;
type AnyDefinition = FactoryDefinition<Table>;
type ConnectedRegistry = Record<string, AutoFactory<Table>>;

export interface FactoryLintIssue {
  key: string;
  table: string;
  error: Error;
}

export function connectRuntimeRegistry(
  binding: FactoryBinding<unknown>,
  tables: TableMap,
  definitions: Record<string, AnyDefinition | undefined> | undefined,
  inference: FactoryInferenceOptions<Table> | undefined,
  runtimeRelations: RuntimeRelations | undefined,
) {
  const resolvedDefinitions = normalizeDefinitions(tables, definitions, inference);
  const registry: ConnectedRegistry = {};
  const tableMap = new Map<Table, AutoFactory<Table>>();
  const runtimeBinding = {
    ...binding,
    inference,
    registry: tableMap,
    relations: runtimeRelations,
  };

  for (const [key, definition] of Object.entries(resolvedDefinitions)) {
    registry[key] = definition.connect(runtimeBinding);
  }

  for (const [key, table] of Object.entries(tables)) {
    tableMap.set(table, registry[key]!);
  }

  return registry;
}

export function attachRegistryHelpers<TTables extends TableMap>(
  registry: ConnectedRegistry,
  tables: TTables,
) {
  Object.defineProperty(registry, "get", {
    enumerable: false,
    value(input: string | Table) {
      if (typeof input === "string") {
        const value = registry[input];

        if (!value) {
          throw new Error(`Unknown runtime factory "${input}".`);
        }

        return value;
      }

      for (const [key, table] of Object.entries(tables)) {
        if (table === input) {
          return registry[key]!;
        }
      }

      throw new Error(`Table "${tableNameOf(input)}" is not registered in this runtime.`);
    },
  });

  Object.defineProperty(registry, "resetSequences", {
    enumerable: false,
    value(next = 0) {
      for (const value of Object.values(registry)) {
        value.resetSequence(next);
      }
    },
  });

  Object.defineProperty(registry, "lint", {
    enumerable: false,
    async value() {
      const issues: FactoryLintIssue[] = [];

      for (const [key, value] of Object.entries(registry)) {
        try {
          await value.build();
        } catch (error) {
          const table = tables[key as keyof TTables];

          issues.push({
            error: normalizeError(error),
            key,
            table: table ? tableNameOf(table) : key,
          });
        }
      }

      return issues;
    },
  });

  Object.defineProperty(registry, "verifyCreates", {
    enumerable: false,
    async value() {
      const issues: FactoryLintIssue[] = [];

      for (const [key, value] of Object.entries(registry)) {
        try {
          await value.createMany(2);
        } catch (error) {
          const table = tables[key as keyof TTables];

          issues.push({
            error: normalizeError(error),
            key,
            table: table ? tableNameOf(table) : key,
          });
        }
      }

      return issues;
    },
  });

  return registry;
}

export function assertDefinitionsMatchTables(
  tables: TableMap,
  definitions: Record<string, AnyDefinition | undefined> | undefined,
) {
  if (!definitions) {
    return;
  }

  for (const key of Object.keys(definitions)) {
    if (!(key in tables)) {
      throw new Error(`Unknown definition key "${key}". Add the matching table to the runtime.`);
    }
  }
}

function normalizeDefinitions(
  tables: TableMap,
  definitions: Record<string, AnyDefinition | undefined> | undefined,
  inference: FactoryInferenceOptions<Table> | undefined,
) {
  assertDefinitionsMatchTables(tables, definitions);

  const resolved = {} as Record<string, AutoFactory<Table>>;

  for (const [key, table] of Object.entries(tables)) {
    const definition = definitions?.[key];
    resolved[key] = definition
      ? asAutoFactory(definition, key)
      : inference
        ? fromTable(table, { inference })
        : fromTable(table);
  }

  return resolved;
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function asAutoFactory(definition: AnyDefinition, key: string) {
  const candidate = definition as unknown as {
    [FACTORY_INSTANCE]?: unknown;
    connect?: unknown;
  };

  if (candidate[FACTORY_INSTANCE] !== true || typeof candidate.connect !== "function") {
    throw new Error(
      `Definition "${key}" was not created by kiri-factory. Pass a value returned by defineFactory(...).`,
    );
  }

  return definition as unknown as AutoFactory<Table>;
}
