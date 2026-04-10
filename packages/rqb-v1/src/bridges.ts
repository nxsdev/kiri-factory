import type { Table } from "drizzle-orm";

/**
 * Declarative stable-to-direct many-to-many bridge.
 *
 * Use this when stable `relations(...)` only exposes the junction table but you
 * want test code to call `hasMany("groups")` instead of working through the
 * join table explicitly.
 */
export interface ManyToManyBridge<
  TThrough extends Table = Table,
  TSource extends string = string,
  TTarget extends string = string,
> {
  readonly kind: "manyToMany";
  readonly through: TThrough;
  readonly source: TSource;
  readonly target: TTarget;
}

/**
 * Declares one virtual direct many-to-many edge for stable Drizzle relations.
 */
export function manyToMany<
  TThrough extends Table,
  TSource extends string,
  TTarget extends string,
>(config: {
  through: TThrough;
  source: TSource;
  target: TTarget;
}): ManyToManyBridge<TThrough, TSource, TTarget> {
  return Object.freeze({
    kind: "manyToMany",
    ...config,
  });
}
