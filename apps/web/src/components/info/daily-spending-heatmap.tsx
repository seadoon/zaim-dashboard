import { getTransactionsByMonth } from "@moneyforward-daily-action/db";
import { parseMonthString } from "../../lib/calendar";
import { DailySpendingHeatmapClient } from "./daily-spending-heatmap.client";

interface DailySpendingHeatmapProps {
  month?: string; // "YYYY-MM" - if omitted, uses the latest month
}

export function DailySpendingHeatmap({ month }: DailySpendingHeatmapProps) {
  const now = new Date();
  const targetMonth =
    month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const transactions = getTransactionsByMonth(targetMonth);

  const dailyMap = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type === "payment") {
      dailyMap.set(tx.date, (dailyMap.get(tx.date) ?? 0) + tx.amount);
    }
  }

  const dailyData = Array.from(dailyMap.entries()).map(([date, amount]) => ({ date, amount }));
  const { year, month: m } = parseMonthString(targetMonth);

  return (
    <DailySpendingHeatmapClient
      title="日別支出ヒートマップ"
      year={year}
      monthIndex={m - 1}
      dailyData={dailyData}
    />
  );
}
