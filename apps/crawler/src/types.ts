export interface RfBrokerBreakdown {
  broker: string;
  total: number;
  dailyChange: number | null;
}

export interface RfTypeBreakdown {
  type: string;
  total: number;
  dailyChange: number;
}

export interface NotificationData {
  totalAssets: number;
  zaimBankTotal: number;
  rfSecuritiesTotal: number;
  dailyChange: number | null;
  monthlyChange: number | null;
  monthlyChangePrevious: number | null;
  zaimBankDailyChange: number | null;
  rfSecuritiesDailyChange: number | null;
  rfByBroker: RfBrokerBreakdown[];
  rfByType: RfTypeBreakdown[];
  updatedAt: string;
}
