import { desc } from "drizzle-orm";
import { getDb, type Db } from "../index";
import { nikkoHoldings } from "../schema/schema";

function parseJpNumber(s: string): number {
  return Number(s.replace(/,/g, ""));
}

export interface NikkoBalanceResponse {
  sMotibnKbsu: string;
  sAvSyutkTnka: string;
  sMeignmRyakKnj: string;
  sMeigaraCd: string;
  sKystKingkRuik: string;
  sSyoreiKinRuik: string;
}

export function saveNikkoHolding(data: NikkoBalanceResponse, db: Db = getDb()): void {
  db.insert(nikkoHoldings).values({
    fetchedAt: new Date().toISOString(),
    stockCode: data.sMeigaraCd,
    stockName: data.sMeignmRyakKnj,
    shares: parseJpNumber(data.sMotibnKbsu),
    avgCostPrice: parseJpNumber(data.sAvSyutkTnka),
    totalContribution: parseJpNumber(data.sKystKingkRuik),
    totalIncentive: parseJpNumber(data.sSyoreiKinRuik),
  }).run();
}

export function getLatestNikkoHolding(db: Db = getDb()) {
  return db.select().from(nikkoHoldings).orderBy(desc(nikkoHoldings.fetchedAt)).limit(1).all()[0] ?? null;
}
