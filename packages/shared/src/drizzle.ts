import type { Table } from "drizzle-orm";

import type { FactoryAdapter } from "./types";

/**
 * Default persistence adapter used by `createFactories({ db, ... })`.
 *
 * It inserts with Drizzle and expects the driver to support `returning()`.
 */
export function drizzleReturning<DB>(): FactoryAdapter<DB> {
  return {
    async create<TTable extends Table>({
      db,
      table,
      values,
    }: {
      db: DB;
      table: TTable;
      values: import("drizzle-orm").InferInsertModel<TTable>;
    }) {
      const insertBuilder = (
        db as {
          insert: (table: TTable) => {
            values: (value: import("drizzle-orm").InferInsertModel<TTable>) => {
              returning?: () => Promise<import("drizzle-orm").InferSelectModel<TTable>[]>;
            };
          };
        }
      ).insert(table);
      const valuesBuilder = insertBuilder.values(values);

      if (typeof valuesBuilder.returning !== "function") {
        throw new Error(
          `The configured Drizzle driver for "${(table as { _: { name: string } })._.name}" does not support returning(). Supply a custom adapter for create().`,
        );
      }

      const rows = await valuesBuilder.returning();
      const row = rows[0];

      if (!row) {
        throw new Error(
          `Expected create() to return one row for "${(table as { _: { name: string } })._.name}", but received none.`,
        );
      }

      return row;
    },
  };
}
