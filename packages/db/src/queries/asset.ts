import { desc, eq, sql, and } from "drizzle-orm";
import { getDb, type Db, schema } from "../index";
import { getZaimDailyBankTotal } from "./zaim";
import { getLatestSnapshot } from "./holding";

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

/** 最新スナップショットの資産をassetType別に集計（Zaim銀行残高を加算） */
export function getAssetBreakdownByCategory(db: Db = getDb()) {
  const latest = getLatestSnapshot(db);
  if (!latest) return [];

  const rows = db
    .select({
      assetType: schema.rfHoldings.assetType,
      amount: schema.rfHoldingValues.amount,
    })
    .from(schema.rfHoldingValues)
    .innerJoin(schema.rfHoldings, eq(schema.rfHoldingValues.holdingId, schema.rfHoldings.id))
    .where(eq(schema.rfHoldingValues.snapshotId, latest.id))
    .all();

  const typeMap = new Map<string, number>();
  for (const row of rows) {
    typeMap.set(row.assetType, (typeMap.get(row.assetType) ?? 0) + row.amount);
  }

  const result = [...typeMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .filter((c) => c.amount > 0);

  const zaimBank = getZaimDailyBankTotal(latest.date, db);
  if (zaimBank > 0) {
    result.push({ category: "銀行・現金", amount: zaimBank });
  }

  return result.sort((a, b) => b.amount - a.amount);
}

/** robofolioは負債を管理しないため空配列を返す */
export function getLiabilityBreakdownByCategory(_db: Db = getDb()) {
  return [] as Array<{ category: string; amount: number }>;
}

/** 最新の総資産（証券 + Zaim銀行） */
export function getLatestTotalAssets(db: Db = getDb()): number | null {
  const latest = getLatestSnapshot(db);
  if (!latest) return null;

  const rows = db
    .select({ amount: schema.rfHoldingValues.amount })
    .from(schema.rfHoldingValues)
    .where(eq(schema.rfHoldingValues.snapshotId, latest.id))
    .all();

  const rfTotal = rows.reduce((sum, r) => sum + r.amount, 0);
  const zaimBank = getZaimDailyBankTotal(latest.date, db);
  return rfTotal + zaimBank;
}

/** 前日比・週比・月比の変化を計算 */
export function getCategoryChangesForPeriod(
  period: "daily" | "weekly" | "monthly",
  db: Db = getDb(),
) {
  const latestSnap = getLatestSnapshot(db);
  if (!latestSnap) return null;

  const targetDateStr = calculateTargetDate(latestSnap.date, period);

  const prevSnap = db
    .select()
    .from(schema.rfSnapshots)
    .where(and(sql`${schema.rfSnapshots.date} <= ${targetDateStr}`))
    .orderBy(desc(schema.rfSnapshots.date))
    .limit(1)
    .get();

  if (!prevSnap || prevSnap.date === latestSnap.date) return null;

  const getTotal = (snapshotId: number, date: string) => {
    const rows = db
      .select({ amount: schema.rfHoldingValues.amount })
      .from(schema.rfHoldingValues)
      .where(eq(schema.rfHoldingValues.snapshotId, snapshotId))
      .all();
    const rf = rows.reduce((sum, r) => sum + r.amount, 0);
    return rf + getZaimDailyBankTotal(date, db);
  };

  const getCategories = (snapshotId: number) => {
    const rows = db
      .select({
        assetType: schema.rfHoldings.assetType,
        amount: schema.rfHoldingValues.amount,
      })
      .from(schema.rfHoldingValues)
      .innerJoin(schema.rfHoldings, eq(schema.rfHoldingValues.holdingId, schema.rfHoldings.id))
      .where(eq(schema.rfHoldingValues.snapshotId, snapshotId))
      .all();
    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.assetType, (map.get(r.assetType) ?? 0) + r.amount);
    }
    return map;
  };

  const currentTotal = getTotal(latestSnap.id, latestSnap.date);
  const previousTotal = getTotal(prevSnap.id, prevSnap.date);
  const latestCats = getCategories(latestSnap.id);
  const previousCats = getCategories(prevSnap.id);

  const latestZaim = getZaimDailyBankTotal(latestSnap.date, db);
  const prevZaim = getZaimDailyBankTotal(prevSnap.date, db);
  if (latestZaim > 0) latestCats.set("銀行・現金", latestZaim);
  if (prevZaim > 0) previousCats.set("銀行・現金", prevZaim);

  const allKeys = new Set([...latestCats.keys(), ...previousCats.keys()]);
  const categories = [...allKeys]
    .map((name) => ({
      name,
      current: latestCats.get(name) ?? 0,
      previous: previousCats.get(name) ?? 0,
      change: (latestCats.get(name) ?? 0) - (previousCats.get(name) ?? 0),
    }))
    .filter((c) => c.current > 0 || c.previous > 0);

  return {
    categories,
    total: {
      current: currentTotal,
      previous: previousTotal,
      change: currentTotal - previousTotal,
    },
  };
}

/** 日次資産推移（全スナップショット分） */
export function getAssetHistoryWithCategories(
  options?: { limit?: number },
  db: Db = getDb(),
) {
  const query = db
    .select()
    .from(schema.rfSnapshots)
    .orderBy(desc(schema.rfSnapshots.date));

  const snapshots = options?.limit ? query.limit(options.limit).all() : query.all();

  return snapshots.map((snap) => {
    const rows = db
      .select({
        assetType: schema.rfHoldings.assetType,
        amount: schema.rfHoldingValues.amount,
      })
      .from(schema.rfHoldingValues)
      .innerJoin(schema.rfHoldings, eq(schema.rfHoldingValues.holdingId, schema.rfHoldings.id))
      .where(eq(schema.rfHoldingValues.snapshotId, snap.id))
      .all();

    const categories: Record<string, number> = {};
    let rfTotal = 0;
    for (const r of rows) {
      categories[r.assetType] = (categories[r.assetType] ?? 0) + r.amount;
      rfTotal += r.amount;
    }

    const zaimBank = getZaimDailyBankTotal(snap.date, db);
    if (zaimBank > 0) {
      categories["銀行・現金"] = zaimBank;
    }

    return {
      date: snap.date,
      totalAssets: rfTotal + zaimBank,
      categories,
    };
  });
}

/** 前日比の資産変化 */
export function getDailyAssetChange(db: Db = getDb()) {
  const result = getCategoryChangesForPeriod("daily", db);
  if (!result) return null;
  return { today: result.total.current, yesterday: result.total.previous, change: result.total.change };
}
