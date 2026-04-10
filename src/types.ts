import type { InferInsertModel, InferSelectModel, Table } from "drizzle-orm";

/**
 * Persists rows built by a factory.
 *
 * Most users can rely on the default Drizzle adapter that powers
 * `createFactories({ db, ... })`. A custom adapter is only needed when
 * `create()` should write through a different persistence strategy.
 */
export interface FactoryAdapter<DB = unknown> {
  create<TTable extends Table>(args: {
    db: DB;
    table: TTable;
    values: InferInsertModel<TTable>;
  }): Promise<InferSelectModel<TTable>>;
}

/**
 * A database plus the adapter used by `create()`.
 */
export interface FactoryBinding<DB = unknown> {
  db: DB;
  adapter: FactoryAdapter<DB>;
}
