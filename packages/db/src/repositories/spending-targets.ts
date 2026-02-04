import { eq, and } from "drizzle-orm";
import type { Db } from "../index";
import type { SpendingTargetsData } from "../types";
import { schema } from "../index";
import { upsertById } from "../utils";

export function saveSpendingTargets(db: Db, groupId: string, data: SpendingTargetsData): void {
  // カテゴリ別の固定費/変動費区分を upsert
  for (const category of data.categories) {
    const catData = {
      groupId,
      largeCategoryId: category.largeCategoryId,
      categoryName: category.name,
      type: category.type,
    };

    upsertById(
      db,
      schema.spendingTargets,
      and(
        eq(schema.spendingTargets.groupId, groupId),
        eq(schema.spendingTargets.largeCategoryId, category.largeCategoryId),
      )!,
      catData,
      catData,
    );
  }
}

export function getSpendingTargets(db: Db, groupId: string) {
  return db
    .select()
    .from(schema.spendingTargets)
    .where(eq(schema.spendingTargets.groupId, groupId))
    .all();
}
