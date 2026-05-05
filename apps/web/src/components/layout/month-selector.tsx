import { getAvailableMonths } from "@moneyforward-daily-action/db";
import { MonthSelectorClient } from "./month-selector.client";

interface MonthSelectorProps {
  currentMonth: string;
  basePath: string;
}

export function MonthSelector({ currentMonth, basePath }: MonthSelectorProps) {
  const availableMonths = getAvailableMonths().map((m) => m.month);

  return (
    <MonthSelectorClient
      currentMonth={currentMonth}
      availableMonths={availableMonths}
      basePath={basePath}
    />
  );
}
