import { getTransactions } from "@moneyforward-daily-action/db";
import { PieChart as PieChartIcon } from "lucide-react";
import { consolidateCategories } from "../../lib/aggregation";
import { PieChart } from "../charts/pie-chart";
import { EmptyState } from "../ui/empty-state";

interface TransactionStatsProps {
  year: string;
}

export function TransactionStats({ year }: TransactionStatsProps) {
  const allTransactions = getTransactions();
  const transactions = allTransactions.filter(
    (t) => t.date.substring(0, 4) === year && t.type !== "transfer",
  );

  if (transactions.length === 0) {
    return <EmptyState icon={PieChartIcon} title="カテゴリ別内訳" />;
  }

  const expenseCategoryMap = new Map<string, number>();
  const incomeSubCategoryMap = new Map<string, number>();

  for (const t of transactions) {
    if (t.type === "payment") {
      const category = t.category ?? "その他";
      expenseCategoryMap.set(category, (expenseCategoryMap.get(category) ?? 0) + t.amount);
    } else if (t.type === "income") {
      const subCategory = t.genre ?? t.category ?? "その他";
      incomeSubCategoryMap.set(subCategory, (incomeSubCategoryMap.get(subCategory) ?? 0) + t.amount);
    }
  }

  const expenseByCategory = consolidateCategories(
    Array.from(expenseCategoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
  );

  const incomeBySubCategory = consolidateCategories(
    Array.from(incomeSubCategoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
  );

  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
      {incomeBySubCategory.length > 0 && (
        <PieChart
          title="収入カテゴリ別内訳"
          data={incomeBySubCategory}
          height={280}
          useCustomColors={false}
        />
      )}
      {expenseByCategory.length > 0 && (
        <PieChart title="支出カテゴリ別内訳" data={expenseByCategory} height={280} />
      )}
    </div>
  );
}
