import type { Metadata } from "next";
import { hasInvestmentHoldings } from "@moneyforward-daily-action/db";
import { rfUrls } from "@moneyforward-daily-action/meta/urls";
import { AssetHistoryChart } from "../../components/info/asset-history-chart";
import { BalanceSheetChart } from "../../components/info/balance-sheet-chart";
import { HoldingsTable } from "../../components/info/holdings-table";
import { UnrealizedGainCard } from "../../components/info/unrealized-gain-card";
import { PageLayout } from "../../components/layout/page-layout";

export const metadata: Metadata = {
  title: "資産",
};

export default function BSPage() {
  const showUnrealizedGain = hasInvestmentHoldings();

  return (
    <PageLayout title="資産" href={rfUrls.portfolio}>
      <BalanceSheetChart />
      <AssetHistoryChart />
      {showUnrealizedGain && <UnrealizedGainCard />}
      <HoldingsTable />
    </PageLayout>
  );
}
