import { sql, inArray } from "drizzle-orm";
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
