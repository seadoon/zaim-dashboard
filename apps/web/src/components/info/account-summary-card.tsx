import { getAccountByMfId } from "@moneyforward-daily-action/db";
import { getHoldingsByAccountId } from "@moneyforward-daily-action/db";
import { WalletIcon } from "lucide-react";
import { AmountDisplay } from "../ui/amount-display";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { EmptyState } from "../ui/empty-state";

interface AccountSummaryCardProps {
  mfId: string;
  groupId?: string;
}

export function AccountSummaryCard({ mfId, groupId }: AccountSummaryCardProps) {
  const account = getAccountByMfId(mfId, groupId);

  if (!account) {
    return <EmptyState icon={WalletIcon} title="サマリー" />;
  }

  const holdings = getHoldingsByAccountId(account.id, groupId);
  const assets = holdings.filter((h) => h.type === "asset" && h.amount);
  const liabilities = holdings.filter((h) => h.type === "liability" && h.amount);

  const holdingsTotal = assets.reduce((sum, h) => sum + (h.amount || 0), 0);
  const liabilitiesTotal = liabilities.reduce((sum, h) => sum + (h.amount || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={WalletIcon}>サマリー</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">総資産</div>
            <div>
              <AmountDisplay amount={account.totalAssets} size="2xl" weight="bold" />
            </div>
          </div>
          {holdingsTotal > 0 && (
            <div>
              <div className="text-sm text-muted-foreground">保有資産</div>
              <div>
                <AmountDisplay amount={holdingsTotal} size="xl" weight="semibold" />
              </div>
            </div>
          )}
          {liabilitiesTotal > 0 && (
            <div>
              <div className="text-sm text-muted-foreground">負債</div>
              <div>
                <AmountDisplay
                  amount={-liabilitiesTotal}
                  type="balance"
                  size="xl"
                  weight="semibold"
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
