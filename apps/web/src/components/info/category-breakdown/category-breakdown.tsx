import { getMonthlyCategoryTotals } from "@moneyforward-daily-action/db";
import { getTransactionsByMonth } from "@moneyforward-daily-action/db";
import { List } from "lucide-react";
import { parseMonthString } from "../../../lib/calendar";
import { EmptyState } from "../../ui/empty-state";
import { CategoryBreakdownClient, type CategoryData } from "./category-breakdown.client";

interface CategoryBreakdownProps {
  month: string;
  type: "income" | "expense";
}

const CONFIG = {
  income: { title: "収入内訳" },
  expense: { title: "支出内訳" },
} as const;

function getPreviousMonth(monthStr: string): string {
  const { year, month } = parseMonthString(monthStr);
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Zaim type mapping: "payment" = expense, "income" = income
function zaimTypeToUiType(zaimType: string): "income" | "expense" | null {
  if (zaimType === "income") return "income";
  if (zaimType === "payment") return "expense";
  return null;
}

export function CategoryBreakdown({ month, type }: CategoryBreakdownProps) {
  const categoryTotals = getMonthlyCategoryTotals(month);
  const transactions = getTransactionsByMonth(month);

  const prevMonth = getPreviousMonth(month);
  const prevCategoryTotals = getMonthlyCategoryTotals(prevMonth);
  const prevAmountByCategory: Record<string, number> = {};
  for (const c of prevCategoryTotals) {
    const uiType = zaimTypeToUiType(c.type);
    if (uiType === type) {
      prevAmountByCategory[c.category] = (prevAmountByCategory[c.category] ?? 0) + c.totalAmount;
    }
  }

  const filteredTransactions = transactions.filter((tx) => tx.type !== "transfer");

  // genre = sub-category in Zaim
  const genreMap = filteredTransactions.reduce(
    (acc, tx) => {
      const uiType = zaimTypeToUiType(tx.type);
      if (!uiType) return acc;
      const key = `${tx.category}:${uiType}`;
      if (!acc[key]) acc[key] = {};
      const sub = tx.genre || "未分類";
      if (!acc[key][sub]) acc[key][sub] = [];
      acc[key][sub].push({
        date: tx.date,
        description: tx.name ?? tx.place ?? "",
        amount: tx.amount,
      });
      return acc;
    },
    {} as Record<
      string,
      Record<string, Array<{ date: string; description: string; amount: number }>>
    >,
  );

  function buildSubCategories(categoryKey: string) {
    const subs = genreMap[categoryKey] || {};
    return Object.entries(subs)
      .map(([subCategory, txs]) => ({
        subCategory,
        amount: txs.reduce((sum, tx) => sum + tx.amount, 0),
        transactions: txs.sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  const data: CategoryData[] = categoryTotals
    .filter((c) => zaimTypeToUiType(c.type) === type)
    .map((c) => ({
      category: c.category,
      amount: c.totalAmount,
      subCategories: buildSubCategories(`${c.category}:${type}`),
    }))
    .sort((a, b) => b.amount - a.amount);

  if (data.length === 0) {
    return <EmptyState icon={List} title={CONFIG[type].title} />;
  }

  return (
    <CategoryBreakdownClient
      title={CONFIG[type].title}
      data={data}
      type={type}
      prevAmountByCategory={prevAmountByCategory}
    />
  );
}
