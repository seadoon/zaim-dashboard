import type { Metadata } from "next";
import { getRfBrokers } from "@moneyforward-daily-action/db";
import { getHoldingsWithLatestValues } from "@moneyforward-daily-action/db";
import { rfUrls } from "@moneyforward-daily-action/meta/urls";
import { Landmark } from "lucide-react";
import { PageLayout } from "../../components/layout/page-layout";
import { AmountDisplay } from "../../components/ui/amount-display";
import { Card, CardHeader, CardTitle } from "../../components/ui/card";

export const metadata: Metadata = {
  title: "証券口座",
};

export default function AccountsPage() {
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

  return (
    <PageLayout title="証券口座" href={rfUrls.portfolio}>
      {brokers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">証券口座データがありません。</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...brokerTotals.values()]
            .sort((a, b) => b.total - a.total)
            .map((b) => (
              <Card key={b.name}>
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
      )}
    </PageLayout>
  );
}
