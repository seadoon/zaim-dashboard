import {
  getAssetBreakdownByCategory,
  getLatestTotalAssets,
  getLatestNetWorth,
  getLiabilityBreakdownByCategory,
} from "@moneyforward-daily-action/db";
import { Scale } from "lucide-react";
import { EmptyState } from "../ui/empty-state";
import { BalanceSheetChartClient } from "./balance-sheet-chart.client";

export function BalanceSheetChart() {
  const assets = getAssetBreakdownByCategory();
  const totalAssets = getLatestTotalAssets();
  const netAssets = getLatestNetWorth();

  if (totalAssets === null || netAssets === null) {
    return <EmptyState icon={Scale} title="バランスシート" />;
  }

  return (
    <BalanceSheetChartClient
      assets={assets}
      liabilities={getLiabilityBreakdownByCategory()}
      netAssets={netAssets}
    />
  );
}
