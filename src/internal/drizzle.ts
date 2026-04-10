import type { Table } from "drizzle-orm";

import { tableNameOf } from "./drizzle-introspection";
import type { FactoryAdapter } from "./types";

/**
 * Default persistence adapter used by `createFactories({ db, ... })`.
 *
 * It inserts with Drizzle and expects the driver to support `returning()`.
 */
export function drizzleReturning<DB>(): FactoryAdapter<DB> {
  const create = async <TTable extends Table>({
    db,
    table,
    values,
  }: {
    db: DB;
    table: TTable;
    values: import("drizzle-orm").InferInsertModel<TTable>;
  }): Promise<import("drizzle-orm").InferSelectModel<TTable>> => {
    const tableName = tableNameOf(table);

    if (!hasDrizzleInsert(db)) {
      throw new Error(
        `The configured db for "${tableName}" is not a Drizzle database with insert(). Supply a custom adapter for create().`,
      );
    }

    const insertBuilder = db.insert(table);
    const valuesBuilder = insertBuilder.values(values);

    if (typeof valuesBuilder.returning !== "function") {
      throw new Error(
        `The configured Drizzle driver for "${tableName}" does not support returning(). Supply a custom adapter for create().`,
      );
    }

    const rows = await valuesBuilder.returning();
    const row = rows[0] as import("drizzle-orm").InferSelectModel<TTable> | undefined;

    if (!row) {
      throw new Error(`Expected create() to return one row for "${tableName}", but received none.`);
    }

    return row;
  };

  return {
    create,
  };
}

function hasDrizzleInsert<DB, TTable extends Table>(
  db: DB,
): db is DB & {
  insert: (table: TTable) => {
    values: (value: import("drizzle-orm").InferInsertModel<TTable>) => {
      returning?: () => Promise<import("drizzle-orm").InferSelectModel<TTable>[]>;
    };
  };
} {
  return Boolean(
    db &&
    typeof db === "object" &&
    "insert" in (db as Record<string, unknown>) &&
    typeof (db as { insert?: unknown }).insert === "function",
  );
}
