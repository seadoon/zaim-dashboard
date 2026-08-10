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
  /** 純資産（資産合計 - カード債務）。見出しに出す金額 */
  netWorth: number;
  /** 資産合計（カード債務を引く前） */
  totalAssets: number;
  /** Zaim銀行残高のみ（カード・ポイントは含まない） */
  zaimBankTotal: number;
  /** Zaimポイント残高 */
  zaimPointTotal: number;
  /** カード債務（負の値） */
  zaimCardTotal: number;
  /** 日興持株会の評価額 */
  nikkoTotal: number;
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
