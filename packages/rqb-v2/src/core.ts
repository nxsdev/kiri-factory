import type { InferInsertModel, Table } from "drizzle-orm";

/**
 * Per-call column overrides passed to `build()` and `create()`.
 */
export type FactoryOverrides<TTable extends Table> = Partial<InferInsertModel<TTable>>;
