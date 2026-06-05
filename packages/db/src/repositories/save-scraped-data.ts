import { eq, and } from "drizzle-orm";
import type { Db } from "../index";
import { schema } from "../index";
import { now } from "../utils";

export interface RfHoldingInput {
  broker: string;
  code: string | null;
  name: string;
  assetType: string;
  quantity?: number | null;
  avgCostPrice?: number | null;
  unitPrice?: number | null;
  amount: number;
  unrealizedGain?: number | null;
  unrealizedGainPct?: number | null;
  dailyChange?: number | null;
}

export function saveRobofolioData(db: Db, holdings: RfHoldingInput[], date: string): void {
  const ts = now();

  // スナップショット（当日分）をupsert
  let snapshot = db
    .select()
    .from(schema.rfSnapshots)
    .where(eq(schema.rfSnapshots.date, date))
    .get();

  if (!snapshot) {
    const inserted = db
      .insert(schema.rfSnapshots)
      .values({ date, createdAt: ts, updatedAt: ts })
      .returning()
      .get();
    snapshot = inserted;
  } else {
    db.update(schema.rfSnapshots)
      .set({ updatedAt: ts })
      .where(eq(schema.rfSnapshots.id, snapshot.id))
      .run();
  }

  const snapshotId = snapshot.id;

  // 正しいブローカー名でデータが取れた場合、「不明」ブローカーを削除
  const hasRealBrokers = holdings.some((h) => h.broker !== "不明");
  if (hasRealBrokers) {
    db.delete(schema.rfBrokers).where(eq(schema.rfBrokers.name, "不明")).run();
  }

  for (const h of holdings) {
    // ブローカーをupsert
    let broker = db
      .select()
      .from(schema.rfBrokers)
      .where(eq(schema.rfBrokers.name, h.broker))
      .get();

    if (!broker) {
      const inserted = db
        .insert(schema.rfBrokers)
        .values({ name: h.broker, createdAt: ts, updatedAt: ts })
        .returning()
        .get();
      broker = inserted;
    }

    const brokerId = broker.id;

    // 銘柄をupsert（ブローカー×コード×名前で識別）
    let holding = h.code
      ? db
          .select()
          .from(schema.rfHoldings)
          .where(and(eq(schema.rfHoldings.brokerId, brokerId), eq(schema.rfHoldings.code, h.code)))
          .get()
      : db
          .select()
          .from(schema.rfHoldings)
          .where(and(eq(schema.rfHoldings.brokerId, brokerId), eq(schema.rfHoldings.name, h.name)))
          .get();

    if (!holding) {
      const inserted = db
        .insert(schema.rfHoldings)
        .values({
          brokerId,
          code: h.code,
          name: h.name,
          assetType: h.assetType,
          isActive: true,
          createdAt: ts,
          updatedAt: ts,
        })
        .returning()
        .get();
      holding = inserted;
    } else {
      db.update(schema.rfHoldings)
        .set({ name: h.name, assetType: h.assetType, isActive: true, updatedAt: ts })
        .where(eq(schema.rfHoldings.id, holding.id))
        .run();
    }

    const holdingId = holding.id;

    // 当日の評価額をupsert
    const existing = db
      .select()
      .from(schema.rfHoldingValues)
      .where(
        and(
          eq(schema.rfHoldingValues.snapshotId, snapshotId),
          eq(schema.rfHoldingValues.holdingId, holdingId),
        ),
      )
      .get();

    const valueData = {
      quantity: h.quantity ?? null,
      avgCostPrice: h.avgCostPrice ?? null,
      unitPrice: h.unitPrice ?? null,
      amount: h.amount,
      unrealizedGain: h.unrealizedGain ?? null,
      unrealizedGainPct: h.unrealizedGainPct ?? null,
      dailyChange: h.dailyChange ?? null,
    };

    if (!existing) {
      db.insert(schema.rfHoldingValues)
        .values({ snapshotId, holdingId, ...valueData, createdAt: ts, updatedAt: ts })
        .run();
    } else {
      db.update(schema.rfHoldingValues)
        .set({ ...valueData, updatedAt: ts })
        .where(eq(schema.rfHoldingValues.id, existing.id))
        .run();
    }
  }
}
