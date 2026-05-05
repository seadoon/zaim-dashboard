import type { Metadata } from "next";
import { MonthlyBalanceCard } from "../components/info/monthly-balance-card";
import { MonthlyIncomeExpenseChart } from "../components/info/monthly-income-expense-chart";
import { DailySpendingHeatmap } from "../components/info/daily-spending-heatmap";
import { PageLayout } from "../components/layout/page-layout";

export const metadata: Metadata = {
  title: "ダッシュボード",
};

export default function DashboardPage() {
  return (
    <PageLayout title="ダッシュボード">
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <MonthlyIncomeExpenseChart className="lg:col-span-2" />
        <MonthlyBalanceCard />
      </div>
      <DailySpendingHeatmap />
    </PageLayout>
  );
}
