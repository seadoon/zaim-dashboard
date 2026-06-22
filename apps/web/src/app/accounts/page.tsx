import type { Metadata } from "next";
import {
  getRfBrokers,
  getHoldingsWithLatestValues,
  getZaimAccountsByCategory,
  getLatestNikkoHolding,
} from "@moneyforward-daily-action/db";
import { rfUrls } from "@moneyforward-daily-action/meta/urls";
import {
  Landmark,
  CreditCard,
  Shield,
  Wallet,
  Star,
  Smartphone,
  ShoppingCart,
  PiggyBank,
  Building2,
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageLayout } from "../../components/layout/page-layout";
import { AmountDisplay } from "../../components/ui/amount-display";
import { Card, CardContent } from "../../components/ui/card";

export const metadata: Metadata = {
  title: "連携サービス",
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  銀行: Landmark,
  カード: CreditCard,
  年金: Shield,
  "電子マネー・プリペイド": Wallet,
  ポイント: Star,
  携帯: Smartphone,
  通販: ShoppingCart,
  貯蓄: PiggyBank,
};

function getCategoryIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category] ?? HelpCircle;
}

export default function AccountsPage() {
  const zaimCategories = getZaimAccountsByCategory();
  const brokers = getRfBrokers();
  const holdings = getHoldingsWithLatestValues();

  const brokerTotals = new Map<number, { name: string; total: number; count: number }>();
  for (const b of brokers) {
    brokerTotals.set(b.id, { name: b.name, total: 0, count: 0 });
  }
  for (const h of holdings) {
    const broker = brokers.find((b) => b.name === h.brokerName);
    if (broker) {
      const prev = brokerTotals.get(broker.id)!;
      brokerTotals.set(broker.id, { ...prev, total: prev.total + h.amount, count: prev.count + 1 });
    }
  }
  const sortedBrokers = [...brokerTotals.values()].sort((a, b) => b.total - a.total);

  const nikko = getLatestNikkoHolding();

  const hasData = zaimCategories.length > 0 || sortedBrokers.length > 0 || nikko !== null;

  return (
    <PageLayout title="連携サービス">
      {!hasData ? (
        <div className="text-center py-12 text-muted-foreground">
          連携サービスのデータがありません。
        </div>
      ) : (
        <div className="space-y-8">
          {zaimCategories.map((cat) => {
            const Icon = getCategoryIcon(cat.category);
            const total = cat.accounts.reduce((s, a) => s + a.balance, 0);
            return (
              <section key={cat.category} className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary shrink-0" />
                    {cat.category}
                    <span className="text-sm font-normal text-muted-foreground">
                      {cat.accounts.length}件
                    </span>
                  </h2>
                  <AmountDisplay amount={total} size="sm" weight="bold" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cat.accounts.map((a) => (
                    <Card key={a.name}>
                      <CardContent className="pt-4 pb-4">
                        <p className="font-medium text-foreground mb-3 text-sm leading-snug line-clamp-2">
                          {a.name}
                        </p>
                        <AmountDisplay amount={a.balance} size="xl" weight="bold" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}

          {sortedBrokers.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-primary shrink-0" />
                  証券口座
                  <span className="text-sm font-normal text-muted-foreground">
                    {sortedBrokers.length}件
                  </span>
                </h2>
                <AmountDisplay
                  amount={sortedBrokers.reduce((s, b) => s + b.total, 0)}
                  size="sm"
                  weight="bold"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sortedBrokers.map((b) => (
                  <Card key={b.name} href={rfUrls.portfolio} target="_blank">
                    <CardContent className="pt-4 pb-4">
                      <p className="font-medium text-foreground mb-3 text-sm">{b.name}</p>
                      <AmountDisplay amount={b.total} size="xl" weight="bold" />
                      <p className="text-xs text-muted-foreground mt-1">{b.count}銘柄</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {nikko && (
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary shrink-0" />
                  持株会
                  <span className="text-sm font-normal text-muted-foreground">1件</span>
                </h2>
                <AmountDisplay
                  amount={nikko.marketValue ?? 0}
                  size="sm"
                  weight="bold"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="font-medium text-foreground mb-3 text-sm">
                      {nikko.stockName}（日興証券）
                    </p>
                    <AmountDisplay amount={nikko.marketValue ?? 0} size="xl" weight="bold" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {nikko.shares}株
                      {nikko.currentPrice != null && ` @ ${nikko.currentPrice.toLocaleString()}円`}
                    </p>
                    {nikko.marketValue != null && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        取得単価 {nikko.avgCostPrice.toLocaleString()}円 / 含み
                        {nikko.marketValue - Math.round(nikko.shares * nikko.avgCostPrice) >= 0 ? "益" : "損"}{" "}
                        {Math.abs(
                          nikko.marketValue - Math.round(nikko.shares * nikko.avgCostPrice),
                        ).toLocaleString()}
                        円
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>
          )}
        </div>
      )}
    </PageLayout>
  );
}
