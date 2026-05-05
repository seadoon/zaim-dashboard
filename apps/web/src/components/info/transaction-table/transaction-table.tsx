import {
  getTransactions,
  getTransactionsByMonth,
} from "@moneyforward-daily-action/db";
import { ListOrdered } from "lucide-react";
import { EmptyState } from "../../ui/empty-state";
import { TransactionTableClient } from "./transaction-table.client";

interface TransactionTableProps {
  month?: string;
}

export function TransactionTable({ month }: TransactionTableProps) {
  const transactions = month
    ? getTransactionsByMonth(month)
    : getTransactions();

  if (transactions.length === 0) {
    return <EmptyState icon={ListOrdered} title="詳細一覧" />;
  }

  return <TransactionTableClient transactions={transactions} isMonthView={!!month} />;
}
