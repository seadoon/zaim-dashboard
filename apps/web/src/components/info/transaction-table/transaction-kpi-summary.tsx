import type { TransactionKpi } from "./types";
import { AmountDisplay } from "../../ui/amount-display";

interface TransactionKpiSummaryProps {
  kpi: TransactionKpi;
}

export function TransactionKpiSummary({ kpi }: TransactionKpiSummaryProps) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <div className="rounded-lg border bg-background p-3">
        <p className="text-sm text-muted-foreground">合計収入</p>
        <p className="mt-0.5">
          <AmountDisplay amount={kpi.totalIncome} type="income" size="lg" weight="bold" />
        </p>
      </div>
      <div className="rounded-lg border bg-background p-3">
        <p className="text-sm text-muted-foreground">合計支出</p>
        <p className="mt-0.5">
          <AmountDisplay amount={kpi.totalExpense} type="expense" size="lg" weight="bold" />
        </p>
      </div>
      <div className="rounded-lg border bg-background p-3">
        <p className="text-sm text-muted-foreground">収支</p>
        <p className="mt-0.5">
          <AmountDisplay amount={kpi.balance} type="balance" size="lg" weight="bold" />
        </p>
      </div>
      <div className="rounded-lg border bg-background p-3">
        <p className="text-sm text-muted-foreground">支出中央値</p>
        <p className="mt-0.5">
          <AmountDisplay amount={kpi.medianExpense} type="expense" size="lg" weight="bold" />
        </p>
      </div>
    </div>
  );
}
