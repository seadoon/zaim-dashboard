import type { Metadata } from "next";
import {
  getRfBrokers,
  getHoldingsWithLatestValues,
  getZaimAccountsByCategory,
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
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageLayout } from "../../components/layout/page-layout";
import { AmountDisplay } from "../../components/ui/amount-display";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";

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

  return (
    <PageLayout title="連携サービス">
      {/* Zaim セクション */}
      {zaimCategories.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Zaim</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {zaimCategories.map((cat) => {
              const Icon = getCategoryIcon(cat.category);
              const total = cat.accounts.reduce((s, a) => s + a.balance, 0);
              return (
                <Card key={cat.category}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle icon={Icon}>{cat.category}</CardTitle>
                      <AmountDisplay amount={total} size="sm" weight="bold" />
                    </div>
                    <p className="text-sm text-muted-foreground">{cat.accounts.length}件</p>
                  </CardHeader>
                  {cat.accounts.length > 1 && (
                    <CardContent>
                      <ul className="space-y-1.5">
                        {cat.accounts.map((a) => (
                          <li key={a.name} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground truncate pr-2">{a.name}</span>
                            <AmountDisplay amount={a.balance} size="sm" />
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* 証券口座 セクション */}
      {sortedBrokers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            証券口座
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              (ロボフォリオ)
            </span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedBrokers.map((b) => (
              <Card key={b.name} href={rfUrls.portfolio} target="_blank">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle icon={Landmark}>{b.name}</CardTitle>
                    <AmountDisplay amount={b.total} size="sm" weight="bold" />
                  </div>
                  <p className="text-sm text-muted-foreground">{b.count}銘柄</p>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      )}

      {zaimCategories.length === 0 && sortedBrokers.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          連携サービスのデータがありません。
        </div>
      )}
    </PageLayout>
  );
}
