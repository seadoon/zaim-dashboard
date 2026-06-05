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

  const brokerNames = [...new Set(withGain.map((h) => h.brokerName))];
  const filterOptions = brokerNames.map((name) => ({ value: name, label: name }));

  return (
    <div className={className}>
      <UnrealizedGainCardClient
        holdings={holdingsData}
        filterOptions={filterOptions}
      />
    </div>
  );
}
