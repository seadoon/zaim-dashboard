import { sql, desc, lte } from "drizzle-orm";
import { getDb, type Db, schema } from "../index";

/**
 * Zaim 連携口座の全カテゴリ合計（銀行 + カード債務 + ポイント等）。
 * カードは負の残高で入っているため、返り値は債務差し引き後の純額になる。
 * 銀行のみの残高が欲しい場合は getZaimDailyBankTotal を使うこと。
 */
export function getZaimAccountsNetTotal(db: Db = getDb()): number {
  const result = db.get<{ total: number }>(
    sql`SELECT COALESCE(SUM(balance), 0) as total FROM zaim_account_balances`,
  );
  return result?.total ?? 0;
}

export function getZaimPointTotal(db: Db = getDb()): number {
  const result = db.get<{ total: number }>(
    sql`SELECT COALESCE(SUM(balance), 0) as total FROM zaim_account_balances WHERE category = 'ポイント'`,
  );
  return result?.total ?? 0;
}

/** カード債務の合計（負の値で返す。債務がなければ 0） */
export function getZaimCardTotal(db: Db = getDb()): number {
  const result = db.get<{ total: number }>(
    sql`SELECT COALESCE(SUM(balance), 0) as total FROM zaim_account_balances WHERE category = 'カード'`,
  );
  return result?.total ?? 0;
}

/** カード債務の明細（金額は正の値に変換して返す） */
export function getZaimLiabilityItems(
  db: Db = getDb(),
): Array<{ name: string; amount: number }> {
  return db.all<{ name: string; amount: number }>(
    sql`SELECT account_name as name, -balance as amount FROM zaim_account_balances WHERE category = 'カード' AND balance < 0 ORDER BY balance ASC`,
  );
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
