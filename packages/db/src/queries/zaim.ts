import { sql, desc, lte } from "drizzle-orm";
import { getDb, type Db, schema } from "../index";

export function getZaimBankTotal(db: Db = getDb()): number {
  const result = db.get<{ total: number }>(
    sql`SELECT COALESCE(SUM(balance), 0) as total FROM zaim_account_balances`,
  );
  return result?.total ?? 0;
}

export function getZaimBankItems(db: Db = getDb()): Array<{ name: string; balance: number }> {
  return db.all<{ name: string; balance: number }>(
    sql`SELECT account_name as name, balance FROM zaim_account_balances WHERE category = '銀行' OR category IS NULL ORDER BY balance DESC`,
  );
}

const CATEGORY_ORDER = ["銀行", "カード", "年金", "電子マネー・プリペイド", "ポイント", "携帯", "通販", "貯蓄"];

export function getZaimAccountsByCategory(
  db: Db = getDb(),
): Array<{ category: string; accounts: Array<{ name: string; balance: number }> }> {
  const rows = db.all<{ category: string | null; name: string; balance: number }>(
    sql`SELECT category, account_name as name, balance FROM zaim_account_balances ORDER BY balance DESC`,
  );

  const map = new Map<string, Array<{ name: string; balance: number }>>();
  for (const row of rows) {
    const cat = row.category ?? "銀行";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push({ name: row.name, balance: row.balance });
  }

  const result: Array<{ category: string; accounts: Array<{ name: string; balance: number }> }> = [];
  for (const cat of CATEGORY_ORDER) {
    if (map.has(cat)) {
      result.push({ category: cat, accounts: map.get(cat)! });
      map.delete(cat);
    }
  }
  for (const [cat, accounts] of map) {
    result.push({ category: cat, accounts });
  }
  return result;
}

export function getZaimDailyBankTotal(date?: string, db: Db = getDb()): number {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const row = db
    .select({ total: schema.zaimDailyBankTotals.total })
    .from(schema.zaimDailyBankTotals)
    .where(lte(schema.zaimDailyBankTotals.date, targetDate))
    .orderBy(desc(schema.zaimDailyBankTotals.date))
    .limit(1)
    .get();
  return row?.total ?? 0;
}

export function getZaimBankHistory(
  options?: { limit?: number },
  db: Db = getDb(),
): Array<{ date: string; total: number }> {
  const query = db
    .select({ date: schema.zaimDailyBankTotals.date, total: schema.zaimDailyBankTotals.total })
    .from(schema.zaimDailyBankTotals)
    .orderBy(desc(schema.zaimDailyBankTotals.date));
  return options?.limit ? query.limit(options.limit).all() : query.all();
}
