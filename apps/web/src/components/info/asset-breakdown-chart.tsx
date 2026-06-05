import {
  getAssetBreakdownByCategory,
  getCategoryChangesForPeriod,
  getLatestTotalAssets,
} from "@moneyforward-daily-action/db";
import { PieChart } from "lucide-react";
import { EmptyState } from "../ui/empty-state";
import { AssetBreakdownChartClient } from "./asset-breakdown-chart.client";

interface AssetBreakdownChartProps {
  className?: string;
}

export function AssetBreakdownChart({ className }: AssetBreakdownChartProps) {
  const data = getAssetBreakdownByCategory();

  if (data.length === 0) {
    return <EmptyState icon={PieChart} title="資産構成" />;
  }

  const totalAssets = getLatestTotalAssets();
  const netAssets = totalAssets;

  const dailyChanges = getCategoryChangesForPeriod("daily");
  const weeklyChanges = getCategoryChangesForPeriod("weekly");
  const monthlyChanges = getCategoryChangesForPeriod("monthly");

  return (
    <AssetBreakdownChartClient
      data={data}
      dailyChanges={dailyChanges}
      weeklyChanges={weeklyChanges}
      monthlyChanges={monthlyChanges}
      netAssets={netAssets}
      className={className}
    />
  );
}
