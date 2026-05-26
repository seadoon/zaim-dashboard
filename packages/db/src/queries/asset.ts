import { desc, eq, sql, and } from "drizzle-orm";
import { getDb, type Db, schema } from "../index";
import { resolveGroupId } from "../shared/group-filter";
import { getHoldingsWithLatestValues } from "./holding";
import { getZaimDailyBankTotal } from "./zaim";

export function parseDateString(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

export function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function calculateTargetDate(
  latestDate: string,
  period: "daily" | "weekly" | "monthly",
): string {
  const { year, month, day } = parseDateString(latestDate);

  if (period === "monthly") {
    const lastDayPrevMonth = new Date(year, month - 1, 0);
    return toDateString(
      lastDayPrevMonth.getFullYear(),
      lastDayPrevMonth.getMonth() + 1,
      lastDayPrevMonth.getDate(),
    );
  }

  const daysAgo = period === "daily" ? 1 : 8;
  const targetDate = new Date(year, month - 1, day - daysAgo);
  return toDateString(targetDate.getFullYear(), targetDate.getMonth() + 1, targetDate.getDate());
}

export function getAssetBreakdownByCategory(groupIdParam?: string, db: Db = getDb()) {
  const groupId = resolveGroupId(db, groupIdParam);
  if (!groupId) return [];

  const latestHistory = db
    .select()
    .from(schema.assetHistory)
    .where(eq(schema.assetHistory.groupId, groupId))
    .orderBy(desc(schema.assetHistory.date))
    .limit(1)
    .get();

  if (!latestHistory) {
    return [];
  }

  const categories = db
    .select()
    .from(schema.assetHistoryCategories)
    .where(eq(schema.assetHistoryCategories.assetHistoryId, latestHistory.id))
    .all();

  const zaimBank = getZaimDailyBankTotal(latestHistory.date, db);
  const result = categories
    .filter((c) => c.amount > 0)
    .map((c) => ({ category: c.categoryName, amount: c.amount }));

  if (zaimBank > 0) {
    result.push({ category: "銀行・現金", amount: zaimBank });
  }

  return result.sort((a, b) => b.amount - a.amount);
}

export function aggregateLiabilitiesByCategory(
  holdings: Array<{
    type: string;
    liabilityCategory: string | null;
    amount: number | null;
  }>,
) {
  const breakdown: Record<string, number> = {};

  for (const holding of holdings) {
    if (holding.type === "liability" && holding.amount) {
      const category = holding.liabilityCategory || "その他";
      breakdown[category] = (breakdown[category] || 0) + holding.amount;
    }
  }

  return Object.entries(breakdown)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function getLiabilityBreakdownByCategory(groupIdParam?: string, db: Db = getDb()) {
  const holdings = getHoldingsWithLatestValues(groupIdParam, db);
  return aggregateLiabilitiesByCategory(holdings);
}

export function getAssetHistory(options?: { limit?: number; groupId?: string }, db: Db = getDb()) {
  const groupId = resolveGroupId(db, options?.groupId);
  if (!groupId) return [];

  const query = db
    .select()
    .from(schema.assetHistory)
    .where(eq(schema.assetHistory.groupId, groupId))
    .orderBy(desc(schema.assetHistory.date));

  if (options?.limit) {
    return query.limit(options.limit).all();
  }
  return query.all();
}

export function getAssetHistoryWithCategories(
  options?: { limit?: number; groupId?: string },
  db: Db = getDb(),
) {
  const groupId = resolveGroupId(db, options?.groupId);
  if (!groupId) return [];

  const historyEntries = (() => {
    const query = db
      .select()
      .from(schema.assetHistory)
      .where(eq(schema.assetHistory.groupId, groupId))
      .orderBy(desc(schema.assetHistory.date));
    return options?.limit ? query.limit(options.limit).all() : query.all();
  })();

  return historyEntries.map((entry) => {
    const cats = db
      .select()
      .from(schema.assetHistoryCategories)
      .where(eq(schema.assetHistoryCategories.assetHistoryId, entry.id))
      .all();

    const categories: Record<string, number> = {};
    for (const cat of cats) {
      categories[cat.categoryName] = cat.amount;
    }

    const zaimBank = getZaimDailyBankTotal(entry.date, db);
    if (zaimBank > 0) {
      categories["銀行・現金"] = zaimBank;
    }

    return {
      date: entry.date,
      totalAssets: entry.totalAssets + zaimBank,
      categories,
    };
  });
}

export function getLatestTotalAssets(groupIdParam?: string, db: Db = getDb()): number | null {
  const groupId = resolveGroupId(db, groupIdParam);
  if (!groupId) return null;

  const latest = db
    .select({ totalAssets: schema.assetHistory.totalAssets, date: schema.assetHistory.date })
    .from(schema.assetHistory)
    .where(eq(schema.assetHistory.groupId, groupId))
    .orderBy(desc(schema.assetHistory.date))
    .limit(1)
    .get();

  if (!latest) return null;
  const zaimBank = getZaimDailyBankTotal(latest.date, db);
  return latest.totalAssets + zaimBank;
}

export function getDailyAssetChange(groupIdParam?: string, db: Db = getDb()) {
  const groupId = resolveGroupId(db, groupIdParam);
  if (!groupId) return null;

  const latest = db
    .select({ totalAssets: schema.assetHistory.totalAssets, date: schema.assetHistory.date })
    .from(schema.assetHistory)
    .where(eq(schema.assetHistory.groupId, groupId))
    .orderBy(desc(schema.assetHistory.date))
    .limit(2)
    .all();

  if (latest.length < 2) {
    return null;
  }

  const todayZaim = getZaimDailyBankTotal(latest[0].date, db);
  const yesterdayZaim = getZaimDailyBankTotal(latest[1].date, db);
  const today = latest[0].totalAssets + todayZaim;
  const yesterday = latest[1].totalAssets + yesterdayZaim;

  return { today, yesterday, change: today - yesterday };
}

export function calculateCategoryChanges(
  latestCategories: Array<{ categoryName: string; amount: number }>,
  previousCategories: Array<{ categoryName: string; amount: number }>,
) {
  const latestMap = new Map(latestCategories.map((c) => [c.categoryName, c.amount]));
  const previousMap = new Map(previousCategories.map((c) => [c.categoryName, c.amount]));

  const allCategoryNames = new Set([...latestMap.keys(), ...previousMap.keys()]);

  return [...allCategoryNames]
    .map((name) => ({
      name,
      current: latestMap.get(name) ?? 0,
      previous: previousMap.get(name) ?? 0,
      change: (latestMap.get(name) ?? 0) - (previousMap.get(name) ?? 0),
    }))
    .filter((cat) => cat.current > 0 || cat.previous > 0);
}

export function getCategoryChangesForPeriod(
  period: "daily" | "weekly" | "monthly",
  groupIdParam?: string,
  db: Db = getDb(),
) {
  const groupId = resolveGroupId(db, groupIdParam);
  if (!groupId) return null;

  const latest = db
    .select()
    .from(schema.assetHistory)
    .where(eq(schema.assetHistory.groupId, groupId))
    .orderBy(desc(schema.assetHistory.date))
    .limit(1)
    .get();

  if (!latest) {
    return null;
  }

  const targetDateStr = calculateTargetDate(latest.date, period);

  const previous = db
    .select()
    .from(schema.assetHistory)
    .where(
      and(
        eq(schema.assetHistory.groupId, groupId),
        sql`${schema.assetHistory.date} <= ${targetDateStr}`,
      ),
    )
    .orderBy(desc(schema.assetHistory.date))
    .limit(1)
    .get();

  if (!previous || previous.date === latest.date) {
    return null;
  }

  const latestCats = db
    .select()
    .from(schema.assetHistoryCategories)
    .where(eq(schema.assetHistoryCategories.assetHistoryId, latest.id))
    .all();
  const previousCats = db
    .select()
    .from(schema.assetHistoryCategories)
    .where(eq(schema.assetHistoryCategories.assetHistoryId, previous.id))
    .all();

  const latestZaim = getZaimDailyBankTotal(latest.date, db);
  const previousZaim = getZaimDailyBankTotal(previous.date, db);

  const latestCategories = [
    ...latestCats,
    ...(latestZaim > 0 ? [{ categoryName: "銀行・現金", amount: latestZaim }] : []),
  ];
  const previousCategories = [
    ...previousCats,
    ...(previousZaim > 0 ? [{ categoryName: "銀行・現金", amount: previousZaim }] : []),
  ];

  const categoryChanges = calculateCategoryChanges(latestCategories, previousCategories);
  const currentTotal = latest.totalAssets + latestZaim;
  const previousTotal = previous.totalAssets + previousZaim;

  return {
    categories: categoryChanges,
    total: {
      current: currentTotal,
      previous: previousTotal,
      change: currentTotal - previousTotal,
    },
  };
}
