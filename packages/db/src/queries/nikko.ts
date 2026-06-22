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

export function saveNikkoHolding(
  data: NikkoBalanceResponse,
  currentPrice: number | null = null,
  db: Db = getDb(),
): void {
  const shares = parseJpNumber(data.sMotibnKbsu);
  db.insert(nikkoHoldings).values({
    fetchedAt: new Date().toISOString(),
    stockCode: data.sMeigaraCd,
    stockName: data.sMeignmRyakKnj,
    shares,
    avgCostPrice: parseJpNumber(data.sAvSyutkTnka),
    totalContribution: parseJpNumber(data.sKystKingkRuik),
    totalIncentive: parseJpNumber(data.sSyoreiKinRuik),
    currentPrice,
    marketValue: currentPrice !== null ? Math.round(shares * currentPrice) : null,
  }).run();
}

export function getLatestNikkoHolding(db: Db = getDb()) {
  return db.select().from(nikkoHoldings).orderBy(desc(nikkoHoldings.fetchedAt)).limit(1).all()[0] ?? null;
}
