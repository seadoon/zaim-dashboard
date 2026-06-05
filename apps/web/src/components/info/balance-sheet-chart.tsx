import {
  getAssetBreakdownByCategory,
  getLatestTotalAssets,
} from "@moneyforward-daily-action/db";
import { Scale } from "lucide-react";
import { EmptyState } from "../ui/empty-state";
import { BalanceSheetChartClient } from "./balance-sheet-chart.client";

export function BalanceSheetChart() {
  const assets = getAssetBreakdownByCategory();
  const totalAssets = getLatestTotalAssets();

  if (totalAssets === null) {
    return <EmptyState icon={Scale} title="バランスシート" />;
  }

  return (
    <BalanceSheetChartClient assets={assets} liabilities={[]} netAssets={totalAssets} />
  );
}
