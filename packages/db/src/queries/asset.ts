import { desc, eq, sql, notInArray } from "drizzle-orm";
import { getDb, type Db, schema } from "../index";
import { getZaimDailyBankTotal, getZaimPointTotal } from "./zaim";
import { getLatestSnapshot } from "./holding";

const STOCK_ASSET_TYPES = new Set(["株式", "株式(NISA)", "外国株", "外国株(NISA)", "信用"]);
const FUND_ASSET_TYPES = new Set(["投資信託", "投資信託(NISA)"]);

function consolidateAssetType(assetType: string): string {
  if (STOCK_ASSET_TYPES.has(assetType)) return "個別株";
  if (FUND_ASSET_TYPES.has(assetType)) return "投資信託";
  return "その他";
}

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

/** 最新スナップショットの資産を4カテゴリ（現金・個別株・投資信託・ポイント）に集計 */
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
    const cat = consolidateAssetType(row.assetType);
    typeMap.set(cat, (typeMap.get(cat) ?? 0) + row.amount);
  }

  const result = [...typeMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .filter((c) => c.amount > 0 && c.category !== "その他");

  const zaimBank = getZaimDailyBankTotal(latest.date, db);
  if (zaimBank > 0) result.push({ category: "現金", amount: zaimBank });

  const zaimPoints = getZaimPointTotal(db);
  if (zaimPoints > 0) result.push({ category: "ポイント", amount: zaimPoints });

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

// ── 共通ヘルパー ─────────────────────────────────────────────

function catsFromSnapshot(snapshotId: number, date: string, db: Db): Map<string, number> {
  const rows = db
    .select({ assetType: schema.rfHoldings.assetType, amount: schema.rfHoldingValues.amount })
    .from(schema.rfHoldingValues)
    .innerJoin(schema.rfHoldings, eq(schema.rfHoldingValues.holdingId, schema.rfHoldings.id))
    .where(eq(schema.rfHoldingValues.snapshotId, snapshotId))
    .all();
  const map = new Map<string, number>();
  for (const r of rows) {
    const cat = consolidateAssetType(r.assetType);
    if (cat !== "その他") map.set(cat, (map.get(cat) ?? 0) + r.amount);
  }
  const bank = getZaimDailyBankTotal(date, db);
  if (bank > 0) map.set("現金", bank);
  return map;
}

function totalFromSnapshot(snapshotId: number, date: string, db: Db): number {
  const rows = db
    .select({ amount: schema.rfHoldingValues.amount })
    .from(schema.rfHoldingValues)
    .where(eq(schema.rfHoldingValues.snapshotId, snapshotId))
    .all();
  return rows.reduce((sum, r) => sum + r.amount, 0) + getZaimDailyBankTotal(date, db);
}

function catsFromHistory(date: string, db: Db): Map<string, number> {
  const rows = db
    .select()
    .from(schema.rfAssetHistory)
    .where(eq(schema.rfAssetHistory.date, date))
    .all();
  const map = new Map<string, number>();
  for (const r of rows) {
    const cat = consolidateAssetType(r.assetType);
    if (cat !== "その他") map.set(cat, (map.get(cat) ?? 0) + r.amount);
  }
  const bank = getZaimDailyBankTotal(date, db);
  if (bank > 0) map.set("現金", bank);
  return map;
}

function totalFromHistory(date: string, db: Db): number {
  const rows = db
    .select({ amount: schema.rfAssetHistory.amount })
    .from(schema.rfAssetHistory)
    .where(eq(schema.rfAssetHistory.date, date))
    .all();
  return rows.reduce((sum, r) => sum + r.amount, 0) + getZaimDailyBankTotal(date, db);
}

/** 前日比・週比・月比の変化を計算（rf_snapshotsになければrf_asset_historyにフォールバック） */
export function getCategoryChangesForPeriod(
  period: "daily" | "weekly" | "monthly",
  db: Db = getDb(),
) {
  const latestSnap = getLatestSnapshot(db);
  if (!latestSnap) return null;

  const targetDateStr = calculateTargetDate(latestSnap.date, period);

  const currentTotal = totalFromSnapshot(latestSnap.id, latestSnap.date, db);
  const latestCats = catsFromSnapshot(latestSnap.id, latestSnap.date, db);

  // Previous: try rf_snapshots first
  let previousTotal: number;
  let previousCats: Map<string, number>;

  const prevSnap = db
    .select()
    .from(schema.rfSnapshots)
    .where(sql`${schema.rfSnapshots.date} <= ${targetDateStr}`)
    .orderBy(desc(schema.rfSnapshots.date))
    .limit(1)
    .get();

  if (prevSnap && prevSnap.date !== latestSnap.date) {
    previousTotal = totalFromSnapshot(prevSnap.id, prevSnap.date, db);
    previousCats = catsFromSnapshot(prevSnap.id, prevSnap.date, db);
  } else {
    // Fallback: rf_asset_history (backfill data)
    const histEntry = db
      .select({ date: schema.rfAssetHistory.date })
      .from(schema.rfAssetHistory)
      .where(sql`${schema.rfAssetHistory.date} <= ${targetDateStr}`)
      .orderBy(desc(schema.rfAssetHistory.date))
      .limit(1)
      .get();

    if (!histEntry || histEntry.date === latestSnap.date) return null;

    previousTotal = totalFromHistory(histEntry.date, db);
    previousCats = catsFromHistory(histEntry.date, db);
  }

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
  // Source 1: rf_snapshots (daily scraper — per-holding detail)
  const snapshots = db
    .select()
    .from(schema.rfSnapshots)
    .orderBy(desc(schema.rfSnapshots.date))
    .all();

  const snapshotDates = new Set(snapshots.map((s) => s.date));

  const snapshotResults = snapshots.map((snap) => {
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
      const cat = consolidateAssetType(r.assetType);
      if (cat !== "その他") categories[cat] = (categories[cat] ?? 0) + r.amount;
      rfTotal += r.amount;
    }

    const zaimBank = getZaimDailyBankTotal(snap.date, db);
    if (zaimBank > 0) categories["現金"] = zaimBank;

    return { date: snap.date, totalAssets: rfTotal + zaimBank, categories };
  });

  // Source 2: rf_asset_history (backfill — aggregated by asset type)
  const historyQuery = snapshotDates.size > 0
    ? db.select().from(schema.rfAssetHistory)
        .where(notInArray(schema.rfAssetHistory.date, [...snapshotDates]))
        .orderBy(desc(schema.rfAssetHistory.date))
        .all()
    : db.select().from(schema.rfAssetHistory)
        .orderBy(desc(schema.rfAssetHistory.date))
        .all();

  const historyByDate = new Map<string, { categories: Record<string, number>; rfTotal: number }>();
  for (const row of historyQuery) {
    if (!historyByDate.has(row.date)) historyByDate.set(row.date, { categories: {}, rfTotal: 0 });
    const entry = historyByDate.get(row.date)!;
    const cat = consolidateAssetType(row.assetType);
    if (cat !== "その他") entry.categories[cat] = (entry.categories[cat] ?? 0) + row.amount;
    entry.rfTotal += row.amount;
  }

  const historyResults = [...historyByDate.entries()].map(([date, { categories, rfTotal }]) => {
    const zaimBank = getZaimDailyBankTotal(date, db);
    if (zaimBank > 0) categories["現金"] = zaimBank;
    return { date, totalAssets: rfTotal + zaimBank, categories };
  });

  const all = [...snapshotResults, ...historyResults].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  return options?.limit ? all.slice(0, options.limit) : all;
}

export function upsertAssetHistory(
  entries: Array<{ date: string; assetType: string; amount: number }>,
  db: Db = getDb(),
) {
  const now = new Date().toISOString();
  for (const e of entries) {
    db.insert(schema.rfAssetHistory)
      .values({ date: e.date, assetType: e.assetType, amount: e.amount, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [schema.rfAssetHistory.date, schema.rfAssetHistory.assetType],
        set: { amount: e.amount, updatedAt: now },
      })
      .run();
  }
}

/** 前日比の資産変化 */
export function getDailyAssetChange(db: Db = getDb()) {
  const result = getCategoryChangesForPeriod("daily", db);
  if (!result) return null;
  return { today: result.total.current, yesterday: result.total.previous, change: result.total.change };
}
