import { desc, eq, isNotNull, and } from "drizzle-orm";
import { getDb, type Db, schema } from "../index";

export function getLatestSnapshot(db: Db = getDb()) {
  return db
    .select()
    .from(schema.rfSnapshots)
    .orderBy(desc(schema.rfSnapshots.date))
    .limit(1)
    .get();
}

export type HoldingWithValue = {
  id: number;
  name: string;
  code: string | null;
  assetType: string;
  brokerName: string;
  amount: number;
  quantity: number | null;
  unitPrice: number | null;
  avgCostPrice: number | null;
  unrealizedGain: number | null;
  unrealizedGainPct: number | null;
  dailyChange: number | null;
};

export function getHoldingsWithLatestValues(db: Db = getDb()): HoldingWithValue[] {
  const latest = getLatestSnapshot(db);
  if (!latest) return [];

  return db
    .select({
      id: schema.rfHoldings.id,
      name: schema.rfHoldings.name,
      code: schema.rfHoldings.code,
      assetType: schema.rfHoldings.assetType,
      brokerName: schema.rfBrokers.name,
      amount: schema.rfHoldingValues.amount,
      quantity: schema.rfHoldingValues.quantity,
      unitPrice: schema.rfHoldingValues.unitPrice,
      avgCostPrice: schema.rfHoldingValues.avgCostPrice,
      unrealizedGain: schema.rfHoldingValues.unrealizedGain,
      unrealizedGainPct: schema.rfHoldingValues.unrealizedGainPct,
      dailyChange: schema.rfHoldingValues.dailyChange,
    })
    .from(schema.rfHoldingValues)
    .innerJoin(schema.rfHoldings, eq(schema.rfHoldingValues.holdingId, schema.rfHoldings.id))
    .innerJoin(schema.rfBrokers, eq(schema.rfHoldings.brokerId, schema.rfBrokers.id))
    .where(eq(schema.rfHoldingValues.snapshotId, latest.id))
    .orderBy(desc(schema.rfHoldingValues.amount))
    .all();
}

export function getHoldingsWithDailyChange(db: Db = getDb()) {
  const latest = getLatestSnapshot(db);
  if (!latest) return [];

  return db
    .select({
      id: schema.rfHoldings.id,
      name: schema.rfHoldings.name,
      code: schema.rfHoldings.code,
      assetType: schema.rfHoldings.assetType,
      brokerName: schema.rfBrokers.name,
      amount: schema.rfHoldingValues.amount,
      dailyChange: schema.rfHoldingValues.dailyChange,
    })
    .from(schema.rfHoldingValues)
    .innerJoin(schema.rfHoldings, eq(schema.rfHoldingValues.holdingId, schema.rfHoldings.id))
    .innerJoin(schema.rfBrokers, eq(schema.rfHoldings.brokerId, schema.rfBrokers.id))
    .where(
      and(
        eq(schema.rfHoldingValues.snapshotId, latest.id),
        isNotNull(schema.rfHoldingValues.dailyChange),
      ),
    )
    .orderBy(desc(schema.rfHoldingValues.dailyChange))
    .all();
}

export function hasInvestmentHoldings(db: Db = getDb()): boolean {
  const snapshot = getLatestSnapshot(db);
  if (!snapshot) return false;
  const row = db
    .select({ id: schema.rfHoldingValues.id })
    .from(schema.rfHoldingValues)
    .where(eq(schema.rfHoldingValues.snapshotId, snapshot.id))
    .limit(1)
    .get();
  return !!row;
}

export function getRfSecuritiesTotalByBroker(db: Db = getDb()) {
  const latest = getLatestSnapshot(db);
  if (!latest) return [];

  const rows = db
    .select({
      brokerName: schema.rfBrokers.name,
      amount: schema.rfHoldingValues.amount,
      dailyChange: schema.rfHoldingValues.dailyChange,
    })
    .from(schema.rfHoldingValues)
    .innerJoin(schema.rfHoldings, eq(schema.rfHoldingValues.holdingId, schema.rfHoldings.id))
    .innerJoin(schema.rfBrokers, eq(schema.rfHoldings.brokerId, schema.rfBrokers.id))
    .where(eq(schema.rfHoldingValues.snapshotId, latest.id))
    .all();

  const brokerMap = new Map<string, { total: number; dailyChange: number | null }>();
  for (const row of rows) {
    const prev = brokerMap.get(row.brokerName) ?? { total: 0, dailyChange: null };
    brokerMap.set(row.brokerName, {
      total: prev.total + row.amount,
      dailyChange:
        row.dailyChange !== null ? (prev.dailyChange ?? 0) + row.dailyChange : prev.dailyChange,
    });
  }

  return [...brokerMap.entries()]
    .map(([broker, v]) => ({ broker, total: v.total, dailyChange: v.dailyChange }))
    .sort((a, b) => b.total - a.total);
}

export function getRfSecuritiesTotalByType(db: Db = getDb()) {
  const latest = getLatestSnapshot(db);
  if (!latest) return [];

  const rows = db
    .select({
      assetType: schema.rfHoldings.assetType,
      amount: schema.rfHoldingValues.amount,
      dailyChange: schema.rfHoldingValues.dailyChange,
    })
    .from(schema.rfHoldingValues)
    .innerJoin(schema.rfHoldings, eq(schema.rfHoldingValues.holdingId, schema.rfHoldings.id))
    .where(eq(schema.rfHoldingValues.snapshotId, latest.id))
    .all();

  const typeMap = new Map<string, { total: number; dailyChange: number }>();
  for (const row of rows) {
    const prev = typeMap.get(row.assetType) ?? { total: 0, dailyChange: 0 };
    typeMap.set(row.assetType, {
      total: prev.total + row.amount,
      dailyChange: prev.dailyChange + (row.dailyChange ?? 0),
    });
  }

  return [...typeMap.entries()]
    .map(([type, v]) => ({ type, total: v.total, dailyChange: v.dailyChange }))
    .sort((a, b) => b.total - a.total);
}

export function getRfSecuritiesTotal(db: Db = getDb()): number {
  const latest = getLatestSnapshot(db);
  if (!latest) return 0;

  const rows = db
    .select({ amount: schema.rfHoldingValues.amount })
    .from(schema.rfHoldingValues)
    .where(eq(schema.rfHoldingValues.snapshotId, latest.id))
    .all();

  return rows.reduce((sum, r) => sum + r.amount, 0);
}

export function getRfSecuritiesDailyChange(db: Db = getDb()): number | null {
  const latest = getLatestSnapshot(db);
  if (!latest) return null;

  const rows = db
    .select({ dailyChange: schema.rfHoldingValues.dailyChange })
    .from(schema.rfHoldingValues)
    .where(eq(schema.rfHoldingValues.snapshotId, latest.id))
    .all();

  const withChange = rows.filter((r) => r.dailyChange !== null);
  if (withChange.length === 0) return null;
  return withChange.reduce((sum, r) => sum + (r.dailyChange ?? 0), 0);
}
