import { getHoldingsWithLatestValues, getLatestTotalAssets } from "@moneyforward-daily-action/db";
import { PiggyBankIcon } from "lucide-react";
import { AmountDisplay } from "../ui/amount-display";
import { Card, CardHeader, CardTitle } from "../ui/card";
import { EmptyState } from "../ui/empty-state";
import { HoldingsTableClient } from "./holdings-table.client";

export function HoldingsTable() {
  const allHoldings = getHoldingsWithLatestValues();

  if (allHoldings.length === 0) {
    return <EmptyState icon={PiggyBankIcon} title="保有資産" />;
  }

  const total = getLatestTotalAssets() ?? allHoldings.reduce((sum, h) => sum + h.amount, 0);

  const grouped = allHoldings.reduce<
    Record<
      string,
      Array<{
        id: number;
        name: string;
        accountName: string | null;
        amount: number | null;
        unrealizedGain: number | null;
        unrealizedGainPct: number | null;
        dailyChange: number | null;
        avgCostPrice: number | null;
        quantity: number | null;
        unitPrice: number | null;
      }>
    >
  >((acc, h) => {
    const category = h.assetType;
    if (!acc[category]) acc[category] = [];
    acc[category].push({
      id: h.id,
      name: h.name,
      accountName: h.brokerName,
      amount: h.amount,
      unrealizedGain: h.unrealizedGain,
      unrealizedGainPct: h.unrealizedGainPct,
      dailyChange: h.dailyChange,
      avgCostPrice: h.avgCostPrice,
      quantity: h.quantity,
      unitPrice: h.unitPrice,
    });
    return acc;
  }, {});

  const categories = Object.entries(grouped)
    .map(([category, items]) => ({
      category,
      items: items.sort((a, b) => (b.amount || 0) - (a.amount || 0)),
      total: items.reduce((sum, h) => sum + (h.amount || 0), 0),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle icon={PiggyBankIcon}>保有資産</CardTitle>
          <AmountDisplay amount={total} size="lg" weight="bold" />
        </div>
      </CardHeader>
      <HoldingsTableClient categories={categories} hideAccountName={false} />
    </Card>
  );
}
