import { desc, like, sql, eq } from "drizzle-orm";
import { getDb, type Db, schema } from "../index";

export function getTransactions(options?: { limit?: number }, db: Db = getDb()) {
  const query = db
    .select()
    .from(schema.transactions)
    .orderBy(desc(schema.transactions.date));

  if (options?.limit) return query.limit(options.limit).all();
  return query.all();
}

export function getTransactionsByMonth(month: string, db: Db = getDb()) {
  return db
    .select()
    .from(schema.transactions)
    .where(like(schema.transactions.date, `${month}%`))
    .orderBy(desc(schema.transactions.date))
    .all();
}

export function getTransactionsByCategory(category: string, db: Db = getDb()) {
  return db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.category, category))
    .orderBy(desc(schema.transactions.date))
    .all();
}

export function getRecentTransactions(limit = 20, db: Db = getDb()) {
  return db
    .select()
    .from(schema.transactions)
    .where(sql`${schema.transactions.type} != 'transfer'`)
    .orderBy(desc(schema.transactions.date))
    .limit(limit)
    .all();
}
