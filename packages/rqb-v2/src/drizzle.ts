import { drizzleReturning as drizzleReturningRoot } from "../../shared/src/drizzle";

import type { FactoryAdapter } from "./types";

/**
 * Default Drizzle adapter used by `createFactories(...)`.
 */
export function drizzleReturning<DB = unknown>(): FactoryAdapter<DB> {
  return drizzleReturningRoot<DB>() as unknown as FactoryAdapter<DB>;
}
