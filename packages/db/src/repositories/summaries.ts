import { eq, and, notInArray, sql } from "drizzle-orm";
import type { Db } from "../index";
import type { AssetHistoryPoint } from "../types";
import { schema } from "../index";
import { now, convertToIsoDate, upsertById } from "../utils";

// ============================================================================
// Internal Helpers
// ============================================================================

function saveAssetHistoryPoint(db: Db, groupId: string, point: AssetHistoryPoint): number {
  const isoDate = convertToIsoDate(point.date);

  const data = {
    groupId,
    date: isoDate,
    totalAssets: point.totalAssets,
    change: point.change,
  };

  return upsertById(
    db,
    schema.assetHistory,
    and(eq(schema.assetHistory.groupId, groupId), eq(schema.assetHistory.date, isoDate))!,
    data,
    data,
  );
}

function saveAssetHistoryCategories(
  db: Db,
  historyId: number,
  categories: Record<string, number>,
): void {
  const categoryNames = Object.keys(categories);

  // スクレイピング結果にないカテゴリを削除
  if (categoryNames.length > 0) {
    db.delete(schema.assetHistoryCategories)
      .where(
        and(
          eq(schema.assetHistoryCategories.assetHistoryId, historyId),
          notInArray(schema.assetHistoryCategories.categoryName, categoryNames),
        ),
      )
      .run();
  } else {
    // カテゴリが空の場合は全削除
    db.delete(schema.assetHistoryCategories)
      .where(eq(schema.assetHistoryCategories.assetHistoryId, historyId))
      .run();
    return;
  }

  // バルクupsert
  const timestamp = now();
  const records = Object.entries(categories).map(([categoryName, amount]) => ({
    assetHistoryId: historyId,
    categoryName,
    amount,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  // SQLiteではcomposite keyでのonConflictDoUpdateには
  // unique indexが必要（既にasset_history_categories_history_category_idxがある）
  db.insert(schema.assetHistoryCategories)
    .values(records)
    .onConflictDoUpdate({
      target: [
        schema.assetHistoryCategories.assetHistoryId,
        schema.assetHistoryCategories.categoryName,
      ],
      set: {
        amount: sql`excluded.amount`,
        updatedAt: timestamp,
      },
    })
    .run();
}

// ============================================================================
// Public Functions
// ============================================================================

export function saveAssetHistory(db: Db, groupId: string, points: AssetHistoryPoint[]): void {
  for (const point of points) {
    const historyId = saveAssetHistoryPoint(db, groupId, point);
    saveAssetHistoryCategories(db, historyId, point.categories);
  }
}
