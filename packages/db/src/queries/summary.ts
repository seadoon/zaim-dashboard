import { desc, like, ne, sql } from "drizzle-orm";
import { getDb, type Db, schema } from "../index";
import { generateMonthRange } from "../shared/utils";

const EXCLUDED_FROM_COUNT = "集計に含まない";

export function getMonthlySummaries(options?: { limit?: number }, db: Db = getDb()) {
  const oldestResult = db
    .select({
      month: sql<string>`MIN(substr(${schema.transactions.date}, 1, 7))`.as("month"),
    })
    .from(schema.transactions)
    .get();

  if (!oldestResult?.month) return [];

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const allMonths = generateMonthRange(oldestResult.month, currentMonth);

  const results = db
    .select({
      month: sql<string>`substr(${schema.transactions.date}, 1, 7)`.as("month"),
      totalIncome: sql<number>`sum(case when ${schema.transactions.type} = 'income' then ${schema.transactions.amount} else 0 end)`.as("total_income"),
      totalExpense: sql<number>`sum(case when ${schema.transactions.type} = 'payment' then ${schema.transactions.amount} else 0 end)`.as("total_expense"),
    })
    .from(schema.transactions)
    .where(ne(schema.transactions.count, EXCLUDED_FROM_COUNT))
    .groupBy(sql`substr(${schema.transactions.date}, 1, 7)`)
    .orderBy(desc(sql`substr(${schema.transactions.date}, 1, 7)`))
    .all();

  const resultMap = new Map(results.map((r) => [r.month, r]));

  const summaries = allMonths.map((month) => {
    const r = resultMap.get(month);
    const totalIncome = r?.totalIncome ?? 0;
    const totalExpense = r?.totalExpense ?? 0;
    return { month, totalIncome, totalExpense, netIncome: totalIncome - totalExpense };
  });

  if (options?.limit) return summaries.slice(0, options.limit);
  return summaries;
}

export function getLatestMonthlySummary(db: Db = getDb()) {
  return getMonthlySummaries({ limit: 1 }, db)[0];
}

export function getMonthlySummaryByMonth(month: string, db: Db = getDb()) {
  const r = db
    .select({
      totalIncome: sql<number>`sum(case when ${schema.transactions.type} = 'income' then ${schema.transactions.amount} else 0 end)`.as("total_income"),
      totalExpense: sql<number>`sum(case when ${schema.transactions.type} = 'payment' then ${schema.transactions.amount} else 0 end)`.as("total_expense"),
    })
    .from(schema.transactions)
    .where(sql`${schema.transactions.date} LIKE ${`${month}%`} AND ${schema.transactions.count} != ${EXCLUDED_FROM_COUNT}`)
    .get();

  if (!r) return undefined;
  const totalIncome = r.totalIncome ?? 0;
  const totalExpense = r.totalExpense ?? 0;
  return { month, totalIncome, totalExpense, netIncome: totalIncome - totalExpense };
}

export function getMonthlyCategoryTotals(month: string, db: Db = getDb()) {
  return db
    .select({
      category: schema.transactions.category,
      genre: schema.transactions.genre,
      type: schema.transactions.type,
      totalAmount: sql<number>`sum(${schema.transactions.amount})`.as("total_amount"),
    })
    .from(schema.transactions)
    .where(
      sql`substr(${schema.transactions.date}, 1, 7) = ${month} AND ${schema.transactions.type} != 'transfer' AND ${schema.transactions.count} != ${EXCLUDED_FROM_COUNT}`,
    )
    .groupBy(schema.transactions.category, schema.transactions.genre, schema.transactions.type)
    .orderBy(desc(sql<number>`sum(${schema.transactions.amount})`))
    .all()
    .map((r) => ({
      month,
      category: r.category ?? "未分類",
      genre: r.genre ?? "未分類",
      type: r.type as "payment" | "income",
      totalAmount: r.totalAmount ?? 0,
    }));
}

export function getAvailableMonths(db: Db = getDb()) {
  const oldest = db
    .select({
      month: sql<string>`MIN(substr(${schema.transactions.date}, 1, 7))`.as("month"),
    })
    .from(schema.transactions)
    .get();

  if (!oldest?.month) return [];

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return generateMonthRange(oldest.month, currentMonth).map((month) => ({ month }));
}

export function getYearToDateSummary(options?: { year?: number }, db: Db = getDb()) {
  const targetYear = options?.year ?? new Date().getFullYear();
  const r = db
    .select({
      totalIncome: sql<number>`sum(case when ${schema.transactions.type} = 'income' then ${schema.transactions.amount} else 0 end)`.as("total_income"),
      totalExpense: sql<number>`sum(case when ${schema.transactions.type} = 'payment' then ${schema.transactions.amount} else 0 end)`.as("total_expense"),
      monthCount: sql<number>`count(distinct substr(${schema.transactions.date}, 1, 7))`.as("month_count"),
    })
    .from(schema.transactions)
    .where(sql`${schema.transactions.date} LIKE ${`${targetYear}-%`} AND ${schema.transactions.count} != ${EXCLUDED_FROM_COUNT}`)
    .get();

  const totalIncome = r?.totalIncome ?? 0;
  const totalExpense = r?.totalExpense ?? 0;
  return {
    year: targetYear,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    monthCount: r?.monthCount ?? 0,
  };
}

export function getDailyTotals(month: string, db: Db = getDb()) {
  return db
    .select({
      date: schema.transactions.date,
      totalExpense: sql<number>`sum(case when ${schema.transactions.type} = 'payment' then ${schema.transactions.amount} else 0 end)`.as("total_expense"),
    })
    .from(schema.transactions)
    .where(sql`${schema.transactions.date} LIKE ${`${month}%`} AND ${schema.transactions.count} != ${EXCLUDED_FROM_COUNT}`)
    .groupBy(schema.transactions.date)
    .orderBy(schema.transactions.date)
    .all()
    .map((r) => ({ date: r.date, totalExpense: r.totalExpense ?? 0 }));
}
