import { getHoldingsWithLatestValues } from "@moneyforward-daily-action/db";
import { TrendingUp } from "lucide-react";
import { EmptyState } from "../ui/empty-state";
import { UnrealizedGainCardClient } from "./unrealized-gain-card.client";

interface UnrealizedGainCardProps {
  className?: string;
}

export function UnrealizedGainCard({ className }: UnrealizedGainCardProps) {
  const holdings = getHoldingsWithLatestValues();
  const withGain = holdings.filter((h) => h.unrealizedGain !== null);

  if (withGain.length === 0) {
    return <EmptyState icon={TrendingUp} title="含み損益" />;
  }

  const holdingsData = withGain.map((h) => ({
    name: h.name,
    amount: h.amount,
    unrealizedGain: h.unrealizedGain!,
    unrealizedGainPct: h.unrealizedGainPct,
    institution: h.brokerName,
    categoryName: h.assetType,
  }));

  const institutionTotals = new Map<string, number>();
  const institutionCategoryTotals = new Map<string, number>();

  for (const h of withGain) {
    const broker = h.brokerName;
    institutionTotals.set(broker, (institutionTotals.get(broker) ?? 0) + h.amount);
    const key = `${broker}__${h.assetType}`;
    institutionCategoryTotals.set(key, (institutionCategoryTotals.get(key) ?? 0) + h.amount);
  }

  return (
    <div className={className}>
      <UnrealizedGainCardClient
        holdings={holdingsData}
        institutionTotals={[...institutionTotals.entries()].map(([name, total]) => ({ name, total }))}
      />
    </div>
  );
}
