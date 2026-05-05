import type { SortColumn, Transaction } from "./types";
import { getCategoryColor } from "../../../lib/colors";
import { formatDate } from "../../../lib/format";
import { cn } from "../../../lib/utils";
import { AmountDisplay } from "../../ui/amount-display";
import { Badge } from "../../ui/badge";
import { EmptyState } from "../../ui/empty-state";
import { SortableTableHead } from "../../ui/sortable-table-head";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../ui/table";
import { TypeBadge } from "../../ui/type-badge";

interface TransactionDesktopViewProps {
  transactions: Transaction[];
  sortColumn: SortColumn;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
}

export function TransactionDesktopView({
  transactions,
  sortColumn,
  sortDirection,
  onSort,
}: TransactionDesktopViewProps) {
  return (
    <div
      className="hidden md:block overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label="取引一覧"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              column="date"
              label="日付"
              currentSort={sortColumn}
              currentDirection={sortDirection}
              onSort={onSort}
            />
            <SortableTableHead
              column="name"
              label="内容"
              currentSort={sortColumn}
              currentDirection={sortDirection}
              onSort={onSort}
            />
            <SortableTableHead
              column="category"
              label="カテゴリ"
              currentSort={sortColumn}
              currentDirection={sortDirection}
              onSort={onSort}
            />
            <SortableTableHead
              column="type"
              label="種別"
              currentSort={sortColumn}
              currentDirection={sortDirection}
              onSort={onSort}
            />
            <SortableTableHead
              column="amount"
              label="金額"
              currentSort={sortColumn}
              currentDirection={sortDirection}
              onSort={onSort}
              className="text-right"
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length > 0 ? (
            transactions.map((transaction) => (
              <TableRow
                key={transaction.id}
                className={cn(transaction.type === "transfer" && "bg-muted/30")}
              >
                <TableCell className="whitespace-nowrap">{formatDate(transaction.date)}</TableCell>
                <TableCell className="max-w-[300px] truncate">
                  {transaction.name ?? transaction.place ?? "-"}
                </TableCell>
                <TableCell>
                  <Badge
                    style={{
                      backgroundColor: `color-mix(in srgb, ${getCategoryColor(transaction.category ?? "振替")} 15%, transparent)`,
                      borderColor: getCategoryColor(transaction.category ?? "振替"),
                    }}
                    className="border text-foreground"
                  >
                    {transaction.category ?? "振替"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <TypeBadge type={transaction.type} />
                </TableCell>
                <TableCell className="text-right">
                  <AmountDisplay
                    amount={transaction.amount}
                    type={
                      transaction.type === "income"
                        ? "income"
                        : transaction.type === "payment"
                          ? "expense"
                          : "neutral"
                    }
                    className={transaction.type === "transfer" ? "text-transfer" : undefined}
                  />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5}>
                <EmptyState message="取引が見つかりません" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
