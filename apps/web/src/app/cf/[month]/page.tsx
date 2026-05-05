import type { Metadata } from "next";
import { getAvailableMonths, getMonthlySummaryByMonth } from "@moneyforward-daily-action/db";
import { notFound } from "next/navigation";
import { CategoryBreakdown } from "../../../components/info/category-breakdown/category-breakdown";
import { DailySpendingHeatmap } from "../../../components/info/daily-spending-heatmap";
import { DateFilterProvider } from "../../../components/info/date-filter-context";
import { SankeyDiagram } from "../../../components/info/sankey-diagram";
import { TransactionTable } from "../../../components/info/transaction-table/transaction-table";
import { MonthSelector } from "../../../components/layout/month-selector";
import { PageLayout } from "../../../components/layout/page-layout";
import { formatMonth } from "../../../lib/format";

export async function generateStaticParams() {
  const months = getAvailableMonths();
  return months.map(({ month }) => ({ month }));
}

export async function generateMetadata({ params }: PageProps<"/cf/[month]">): Promise<Metadata> {
  const { month } = await params;
  return { title: `収支 - ${formatMonth(month)}` };
}

export default async function PLMonthPage({ params }: PageProps<"/cf/[month]">) {
  const { month } = await params;
  const summary = getMonthlySummaryByMonth(month);

  if (!summary) notFound();

  return (
    <PageLayout
      title={`収支 - ${formatMonth(month)}`}
      options={<MonthSelector currentMonth={month} basePath="/cf" />}
    >
      <SankeyDiagram month={month} />

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <CategoryBreakdown month={month} type="income" />
        <CategoryBreakdown month={month} type="expense" />
      </div>

      <DateFilterProvider>
        <DailySpendingHeatmap month={month} />
        <TransactionTable month={month} />
      </DateFilterProvider>
    </PageLayout>
  );
}
