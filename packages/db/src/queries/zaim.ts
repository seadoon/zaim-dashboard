import { sql, inArray, desc, lte } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { getDb, type Db, schema } from "../index";
import { getLatestSnapshot } from "./holding";

const SECURITIES_ACCOUNT_NAMES = [
  "SBI証券",
  "SMBC日興証券",
  "SMBC日興証券(Next-One)",
  "楽天証券",
];

export function getZaimBankTotal(db: Db = getDb()): number {
  const result = db.get<{ total: number }>(
    sql`SELECT COALESCE(SUM(balance), 0) as total FROM zaim_account_balances`,
  );
  return result?.total ?? 0;
}

export function getZaimBankItems(
  db: Db = getDb(),
): Array<{ name: string; balance: number }> {
  return db.all<{ name: string; balance: number }>(
    sql`SELECT account_name as name, balance FROM zaim_account_balances ORDER BY balance DESC`,
  );
}

export function getMfSecuritiesTotal(db: Db = getDb()): number {
  const latestSnapshot = getLatestSnapshot(db);
  if (!latestSnapshot) return 0;

  const result = db.get<{ total: number }>(sql`
    SELECT COALESCE(SUM(hv.amount), 0) as total
    FROM holding_values hv
    JOIN holdings h ON h.id = hv.holding_id
    JOIN accounts a ON a.id = h.account_id
    WHERE hv.snapshot_id = ${latestSnapshot.id}
      AND a.name IN ('SBI証券', 'SMBC日興証券', 'SMBC日興証券(Next-One)', '楽天証券')
      AND h.type = 'asset'
  `);
  return result?.total ?? 0;
}

export function getMfSecuritiesItems(
  db: Db = getDb(),
): Array<{ name: string; balance: number }> {
  const latestSnapshot = getLatestSnapshot(db);
  if (!latestSnapshot) return [];

  return db.all<{ name: string; balance: number }>(sql`
    SELECT a.name, COALESCE(SUM(hv.amount), 0) as balance
    FROM holding_values hv
    JOIN holdings h ON h.id = hv.holding_id
    JOIN accounts a ON a.id = h.account_id
    WHERE hv.snapshot_id = ${latestSnapshot.id}
      AND a.name IN ('SBI証券', 'SMBC日興証券', 'SMBC日興証券(Next-One)', '楽天証券')
      AND h.type = 'asset'
    GROUP BY a.id, a.name
    ORDER BY balance DESC
  `);
}

export function getMfSecuritiesDailyChange(db: Db = getDb()): number | null {
  const latestSnapshot = getLatestSnapshot(db);
  if (!latestSnapshot) return null;

  const result = db.get<{ total: number | null }>(sql`
    SELECT SUM(hv.daily_change) as total
    FROM holding_values hv
    JOIN holdings h ON h.id = hv.holding_id
    JOIN accounts a ON a.id = h.account_id
    WHERE hv.snapshot_id = ${latestSnapshot.id}
      AND a.name IN ('SBI証券', 'SMBC日興証券', 'SMBC日興証券(Next-One)', '楽天証券')
      AND h.type = 'asset'
      AND hv.daily_change IS NOT NULL
  `);
  return result?.total ?? null;
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

export function getMfSecuritiesByAccount(
  db: Db = getDb(),
): Array<{ account: string; total: number; dailyChange: number | null }> {
  const latestSnapshot = getLatestSnapshot(db);
  if (!latestSnapshot) return [];

  return db.all<{ account: string; total: number; dailyChange: number | null }>(sql`
    SELECT a.name as account,
           COALESCE(SUM(hv.amount), 0) as total,
           SUM(hv.daily_change) as dailyChange
    FROM holding_values hv
    JOIN holdings h ON h.id = hv.holding_id
    JOIN accounts a ON a.id = h.account_id
    WHERE hv.snapshot_id = ${latestSnapshot.id}
      AND a.name IN ('SBI証券', 'SMBC日興証券', 'SMBC日興証券(Next-One)', '楽天証券')
      AND h.type = 'asset'
    GROUP BY a.id, a.name
    ORDER BY total DESC
  `);
}

function classifySecuritiesType(
  categoryName: string | null,
  code: string | null,
): "日本個別株" | "米個別株" | "投資信託" | "その他" {
  if (categoryName === "投資信託") return "投資信託";
  if (categoryName === "株式(現物)") {
    if (code && /^\d{4,5}$/.test(code)) return "日本個別株";
    if (code && /^[A-Z]/.test(code)) return "米個別株";
  }
  return "その他";
}

export function getMfSecuritiesByType(
  db: Db = getDb(),
): Array<{ type: string; total: number; dailyChange: number }> {
  const latestSnapshot = getLatestSnapshot(db);
  if (!latestSnapshot) return [];

  const rows = db.all<{
    code: string | null;
    category: string | null;
    amount: number;
    dailyChange: number | null;
  }>(sql`
    SELECT h.code, ac.name as category, hv.amount, hv.daily_change as dailyChange
    FROM holding_values hv
    JOIN holdings h ON h.id = hv.holding_id
    JOIN accounts a ON a.id = h.account_id
    LEFT JOIN asset_categories ac ON ac.id = h.category_id
    WHERE hv.snapshot_id = ${latestSnapshot.id}
      AND a.name IN ('SBI証券', 'SMBC日興証券', 'SMBC日興証券(Next-One)', '楽天証券')
      AND h.type = 'asset'
  `);

  const grouped = new Map<string, { total: number; dailyChange: number }>();
  for (const row of rows) {
    const type = classifySecuritiesType(row.category, row.code);
    const prev = grouped.get(type) ?? { total: 0, dailyChange: 0 };
    grouped.set(type, {
      total: prev.total + row.amount,
      dailyChange: prev.dailyChange + (row.dailyChange ?? 0),
    });
  }

  const ORDER = ["日本個別株", "米個別株", "投資信託", "その他"];
  return [...grouped.entries()]
    .map(([type, data]) => ({ type, ...data }))
    .filter((r) => r.total > 0)
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
}

export function getMfSecuritiesAccountIssues(
  db: Db = getDb(),
): Array<{ name: string; status: string; errorMessage: string | null }> {
  return db
    .select({
      name: schema.accounts.name,
      status: schema.accountStatuses.status,
      errorMessage: schema.accountStatuses.errorMessage,
    })
    .from(schema.accounts)
    .innerJoin(
      schema.accountStatuses,
      eq(schema.accountStatuses.accountId, schema.accounts.id),
    )
    .where(inArray(schema.accounts.name, SECURITIES_ACCOUNT_NAMES))
    .all()
    .filter((r) => r.status === "updating" || r.status === "error");
}
