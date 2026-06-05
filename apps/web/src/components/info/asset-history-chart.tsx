import { getAssetHistoryWithCategories } from "@moneyforward-daily-action/db";
import { LineChart } from "lucide-react";
import { EmptyState } from "../ui/empty-state";
import { AssetHistoryChartClient } from "./asset-history-chart.client";

export function AssetHistoryChart() {
  const data = getAssetHistoryWithCategories()
    .filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date))
    .reverse();

  if (data.length === 0) {
    return <EmptyState icon={LineChart} title="資産推移" />;
  }

  return <AssetHistoryChartClient data={data} />;
}
