import { sql } from "drizzle-orm";
import { getDb, type Db, schema } from "../index";
import { getLatestSnapshot, getHoldingsWithLatestValues } from "./holding";
import {
  getLatestTotalAssets,
  getAssetHistoryWithCategories,
} from "./asset";
import { getZaimDailyBankTotal } from "./zaim";

export interface AnalyticsMetrics {
  savings: {
    totalAssets: number;
    liquidAssets: number;
    monthlyExpenseAvg: number;
    emergencyFundMonths: number;
  };
  investment: {
    totalInvestment: number;
    totalUnrealizedGain: number;
    totalUnrealizedGainPct: number;
    diversificationScore: number;
  };
  spending: {
    monthlyAverage: number;
    topCategories: Array<{ category: string; amount: number; pct: number }>;
    anomalies: Array<{ category: string; amount: number; deviation: number }>;
  };
  growth: {
    monthlyGrowthRate: number;
    projectedAnnualRate: number;
  };
  balance: {
    monthlyIncome: number;
    monthlyExpense: number;
    savingsRate: number;
    trend: Array<{ month: string; income: number; expense: number; balance: number }>;
  };
  healthScore: {
    totalScore: number;
    categories: Array<{ name: string; score: number; maxScore: number }>;
  };
}

export interface AnalyticsReport {
  metrics: AnalyticsMetrics;
  date: string | null;
}

const ANALYSIS_MONTHS = 12;
const EXCLUDED_FROM_COUNT = "集計に含まない";

function getDateThreshold(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - ANALYSIS_MONTHS);
  return date.toISOString().split("T")[0];
}

interface CollectedData {
  totalAssets: number;
  liquidAssets: number;
  holdings: Array<{
    name: string;
    amount: number;
    unrealizedGain: number | null;
    unrealizedGainPct: number | null;
  }>;
  transactions: Array<{
    date: string;
    category: string | null;
    amount: number;
    type: string;
  }>;
  assetHistory: Array<{ date: string; totalAssets: number }>;
}

function collectData(db: Db): CollectedData {
  const dateThreshold = getDateThreshold();
  const totalAssets = getLatestTotalAssets(db) ?? 0;

  const latestSnap = getLatestSnapshot(db);
  const latestDate = latestSnap?.date ?? new Date().toISOString().slice(0, 10);
  const liquidBank = getZaimDailyBankTotal(latestDate, db);
  const liquidExtra = db.all<{ total: number }>(
    sql`SELECT COALESCE(SUM(balance), 0) as total FROM zaim_account_balances WHERE category IN ('電子マネー・プリペイド', '貯蓄')`,
  );
  const liquidAssets = liquidBank + (liquidExtra[0]?.total ?? 0);

  const holdings = getHoldingsWithLatestValues(db).map((h) => ({
    name: h.name,
    amount: h.amount,
    unrealizedGain: h.unrealizedGain,
    unrealizedGainPct: h.unrealizedGainPct,
  }));

  const currentMonth = new Date().toISOString().slice(0, 7);
  const transactions = db
    .select({
      date: schema.transactions.date,
      category: schema.transactions.category,
      amount: schema.transactions.amount,
      type: schema.transactions.type,
    })
    .from(schema.transactions)
    .where(
      sql`${schema.transactions.date} >= ${dateThreshold} AND substr(${schema.transactions.date}, 1, 7) != ${currentMonth} AND ${schema.transactions.count} != ${EXCLUDED_FROM_COUNT}`,
    )
    .all();

  const assetHistory = getAssetHistoryWithCategories(undefined, db)
    .filter((h) => h.date >= dateThreshold)
    .map((h) => ({ date: h.date, totalAssets: h.totalAssets }));

  return { totalAssets, liquidAssets, holdings, transactions, assetHistory };
}

function countUniqueMonths(dates: string[]): number {
  return new Set(dates.map((d) => d.slice(0, 7))).size;
}

function calculateSavings(data: CollectedData): AnalyticsMetrics["savings"] {
  const expenses = data.transactions.filter((t) => t.type === "payment");
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
  const monthsCount = countUniqueMonths(expenses.map((t) => t.date));
  const monthlyExpenseAvg = monthsCount > 0 ? Math.round(totalExpenses / monthsCount) : 0;
  const emergencyFundMonths =
    monthlyExpenseAvg > 0 ? Math.round((data.liquidAssets / monthlyExpenseAvg) * 10) / 10 : 0;
  return {
    totalAssets: data.totalAssets,
    liquidAssets: data.liquidAssets,
    monthlyExpenseAvg,
    emergencyFundMonths,
  };
}

function calculateDiversificationScore(holdings: Array<{ amount: number }>): number {
  if (holdings.length === 0) return 0;
  if (holdings.length === 1) return 10;
  const total = holdings.reduce((s, h) => s + h.amount, 0);
  if (total === 0) return 0;
  const weights = holdings.map((h) => h.amount / total);
  const herfindahl = weights.reduce((s, w) => s + w * w, 0);
  return Math.min(100, Math.max(0, Math.round((1 - herfindahl) * 100)));
}

function calculateInvestment(data: CollectedData): AnalyticsMetrics["investment"] {
  const totalInvestment = data.holdings.reduce((s, h) => s + h.amount, 0);
  const totalUnrealizedGain = data.holdings.reduce((s, h) => s + (h.unrealizedGain ?? 0), 0);
  const cost = totalInvestment - totalUnrealizedGain;
  const totalUnrealizedGainPct =
    cost > 0 ? Math.round((totalUnrealizedGain / cost) * 10000) / 100 : 0;
  return {
    totalInvestment,
    totalUnrealizedGain,
    totalUnrealizedGainPct,
    diversificationScore: calculateDiversificationScore(data.holdings),
  };
}

function calculateSpending(data: CollectedData): AnalyticsMetrics["spending"] {
  const expenses = data.transactions.filter((t) => t.type === "payment");
  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    const cat = e.category ?? "未分類";
    byCategory[cat] = (byCategory[cat] ?? 0) + e.amount;
  }
  const totalExpenses = Object.values(byCategory).reduce((s, v) => s + v, 0);
  const monthsCount = countUniqueMonths(expenses.map((e) => e.date));

  const monthlyAverage = monthsCount > 0 ? Math.round(totalExpenses / monthsCount) : 0;
  const topCategories = Object.entries(byCategory)
    .map(([category, amount]) => ({
      category,
      amount: monthsCount > 0 ? Math.round(amount / monthsCount) : 0,
      pct: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return { monthlyAverage, topCategories, anomalies: detectAnomalies(data.transactions) };
}

function detectAnomalies(
  transactions: CollectedData["transactions"],
): AnalyticsMetrics["spending"]["anomalies"] {
  const byMonthCategory: Record<string, Record<string, number>> = {};
  for (const t of transactions) {
    if (t.type !== "payment") continue;
    const month = t.date.slice(0, 7);
    const category = t.category ?? "未分類";
    if (!byMonthCategory[month]) byMonthCategory[month] = {};
    byMonthCategory[month][category] = (byMonthCategory[month][category] ?? 0) + t.amount;
  }
  const months = Object.keys(byMonthCategory).sort();
  if (months.length < 3) return [];
  const latestMonth = months[months.length - 1];
  const previousMonths = months.slice(0, -1);

  const allCategories = new Set<string>();
  for (const m of previousMonths) for (const c of Object.keys(byMonthCategory[m])) allCategories.add(c);

  const stats: Record<string, { avg: number; stdDev: number }> = {};
  for (const c of allCategories) {
    const values = previousMonths.map((m) => byMonthCategory[m]?.[c] ?? 0);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
    stats[c] = { avg, stdDev: Math.sqrt(variance) };
  }

  const anomalies: Array<{ category: string; amount: number; deviation: number }> = [];
  const latestData = byMonthCategory[latestMonth] ?? {};
  for (const [category, amount] of Object.entries(latestData)) {
    const s = stats[category];
    if (!s || s.stdDev === 0) continue;
    const deviation = (amount - s.avg) / s.stdDev;
    if (deviation > 2) anomalies.push({ category, amount, deviation: Math.round(deviation * 100) / 100 });
  }
  return anomalies.sort((a, b) => b.deviation - a.deviation).slice(0, 3);
}

function calculateGrowth(data: CollectedData): AnalyticsMetrics["growth"] {
  if (data.assetHistory.length < 2) return { monthlyGrowthRate: 0, projectedAnnualRate: 0 };
  const sorted = [...data.assetHistory].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first.totalAssets <= 0) return { monthlyGrowthRate: 0, projectedAnnualRate: 0 };

  const start = new Date(first.date);
  const end = new Date(last.date);
  const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (monthsDiff <= 0) return { monthlyGrowthRate: 0, projectedAnnualRate: 0 };

  const monthlyGrowthRate =
    Math.round((Math.pow(last.totalAssets / first.totalAssets, 1 / monthsDiff) - 1) * 10000) / 10000;
  if (Math.abs(monthlyGrowthRate) < 0.0001) return { monthlyGrowthRate: 0, projectedAnnualRate: 0 };

  const annualRate = Math.pow(1 + monthlyGrowthRate, 12) - 1;
  return { monthlyGrowthRate, projectedAnnualRate: Math.round(annualRate * 1000) / 1000 };
}

function calculateBalance(data: CollectedData): AnalyticsMetrics["balance"] {
  const byMonth: Record<string, { income: number; expense: number }> = {};
  for (const t of data.transactions) {
    const m = t.date.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { income: 0, expense: 0 };
    if (t.type === "income") byMonth[m].income += t.amount;
    else if (t.type === "payment") byMonth[m].expense += t.amount;
  }
  const trend = Object.entries(byMonth)
    .map(([month, { income, expense }]) => ({ month, income, expense, balance: income - expense }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const totalIncome = trend.reduce((s, m) => s + m.income, 0);
  const totalExpense = trend.reduce((s, m) => s + m.expense, 0);
  const monthsCount = Math.max(1, trend.length);
  const monthlyIncome = Math.round(totalIncome / monthsCount);
  const monthlyExpense = Math.round(totalExpense / monthsCount);
  const savingsRate =
    monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 1000) / 10 : 0;
  return { monthlyIncome, monthlyExpense, savingsRate, trend };
}

function lerp(value: number, min: number, max: number, outMin: number, outMax: number): number {
  if (max === min) return outMax;
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return outMin + t * (outMax - outMin);
}

function scoreEmergencyFund(months: number): number {
  if (months >= 6) return 25;
  if (months <= 0) return 0;
  if (months <= 3) return Math.round(lerp(months, 0, 3, 0, 15));
  return Math.round(lerp(months, 3, 6, 15, 25));
}

function scoreSavingsRate(rate: number): number {
  if (rate >= 30) return 25;
  if (rate <= 0) return 0;
  if (rate <= 10) return Math.round(lerp(rate, 0, 10, 0, 8));
  if (rate <= 20) return Math.round(lerp(rate, 10, 20, 8, 17));
  return Math.round(lerp(rate, 20, 30, 17, 25));
}

function scoreDiversification(score: number): number {
  return Math.round((Math.max(0, Math.min(100, score)) / 100) * 20);
}

function scoreGrowth(monthlyGrowthRate: number): number {
  if (monthlyGrowthRate >= 0.02) return 15;
  if (monthlyGrowthRate <= -0.02) return 0;
  return Math.round(lerp(monthlyGrowthRate, -0.02, 0.02, 0, 15));
}

function scoreSpendingStability(anomalyCount: number): number {
  if (anomalyCount === 0) return 15;
  if (anomalyCount === 1) return 10;
  if (anomalyCount === 2) return 5;
  return 0;
}

function calculateHealthScore(
  metrics: Omit<AnalyticsMetrics, "healthScore">,
): AnalyticsMetrics["healthScore"] {
  const categories = [
    { name: "緊急予備資金", score: scoreEmergencyFund(metrics.savings.emergencyFundMonths), maxScore: 25 },
    { name: "貯蓄率", score: scoreSavingsRate(metrics.balance.savingsRate), maxScore: 25 },
    { name: "投資分散度", score: scoreDiversification(metrics.investment.diversificationScore), maxScore: 20 },
    { name: "資産成長", score: scoreGrowth(metrics.growth.monthlyGrowthRate), maxScore: 15 },
    { name: "支出安定性", score: scoreSpendingStability(metrics.spending.anomalies.length), maxScore: 15 },
  ];
  return { totalScore: categories.reduce((s, c) => s + c.score, 0), categories };
}

function computeMetrics(data: CollectedData): AnalyticsMetrics {
  const savings = calculateSavings(data);
  const investment = calculateInvestment(data);
  const spending = calculateSpending(data);
  const growth = calculateGrowth(data);
  const balance = calculateBalance(data);
  const healthScore = calculateHealthScore({ savings, investment, spending, growth, balance });
  return { savings, investment, spending, growth, balance, healthScore };
}

export function getLatestAnalytics(db: Db = getDb()): AnalyticsReport | null {
  const data = collectData(db);
  if (
    data.totalAssets === 0 &&
    data.holdings.length === 0 &&
    data.transactions.length === 0 &&
    data.assetHistory.length === 0
  ) {
    return null;
  }
  const latestSnap = getLatestSnapshot(db);
  return { metrics: computeMetrics(data), date: latestSnap?.date ?? null };
}
