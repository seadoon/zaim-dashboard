import { getMonthlyCategoryTotals } from "@moneyforward-daily-action/db";
import { GitBranch } from "lucide-react";
import { EmptyState } from "../ui/empty-state";
import { SankeyDiagramClient } from "./sankey-diagram.client";

interface SankeyDiagramProps {
  month: string;
}

export function SankeyDiagram({ month }: SankeyDiagramProps) {
  const categoryTotals = getMonthlyCategoryTotals(month);

  const incomeCategories = categoryTotals
    .filter((c) => c.type === "income")
    .map((c) => ({ category: c.category, amount: c.totalAmount }))
    .sort((a, b) => b.amount - a.amount);

  // "payment" = expense in Zaim
  const expenseCategories = categoryTotals
    .filter((c) => c.type === "payment")
    .map((c) => ({ category: c.category, amount: c.totalAmount }))
    .sort((a, b) => b.amount - a.amount);

  if (incomeCategories.length === 0 && expenseCategories.length === 0) {
    return <EmptyState icon={GitBranch} title="キャッシュフロー" />;
  }

  return <SankeyDiagramClient income={incomeCategories} expense={expenseCategories} height={600} />;
}
