import { getHoldingsWithDailyChange } from "@moneyforward-daily-action/db";
import { ArrowUpDown } from "lucide-react";
import { EmptyState } from "../ui/empty-state";
import { DailyChangeCardClient } from "./daily-change-card.client";

interface DailyChangeCardProps {
  className?: string;
}

export function DailyChangeCard({ className }: DailyChangeCardProps) {
  const holdings = getHoldingsWithDailyChange();

  if (holdings.length === 0) {
    return <EmptyState icon={ArrowUpDown} title="前日比ランキング" />;
  }

  const holdingsData = holdings.map((h) => ({
    name: h.name,
    code: h.code,
    categoryName: h.assetType,
    accountName: h.brokerName,
    dailyChange: h.dailyChange,
  }));

  return (
    <div className={className}>
      <DailyChangeCardClient holdings={holdingsData} />
    </div>
  );
}
