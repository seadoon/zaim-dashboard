import { cn } from "../../lib/utils";
import { AmountDisplay, getAmountColorClass } from "./amount-display";

interface TrendDisplayProps {
  value: number;
  label: string;
  inverse?: boolean;
  className?: string;
}

export function TrendDisplay({ value, label, inverse = false, className }: TrendDisplayProps) {
  const colorClass = getAmountColorClass({ value, type: "balance", inverse });

  return (
    <span className={cn("font-medium", colorClass, className)}>
      <AmountDisplay amount={value} showSign showUnit={false} />({label})
    </span>
  );
}
