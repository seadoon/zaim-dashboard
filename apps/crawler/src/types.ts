export interface ScrapeOptions {
  skipRefresh?: boolean;
}

export interface AccountIssue {
  name: string;
  status: "updating" | "error";
  errorMessage?: string | null;
}

export interface MfAccountBreakdown {
  account: string;
  total: number;
  dailyChange: number | null;
}

export interface MfTypeBreakdown {
  type: string;
  total: number;
  dailyChange: number;
}

export interface NotificationData {
  totalAssets: number;
  zaimBankTotal: number;
  mfSecuritiesTotal: number;
  dailyChange: number | null;
  monthlyChange: number | null;
  monthlyChangePrevious: number | null;
  zaimBankDailyChange: number | null;
  mfSecuritiesDailyChange: number | null;
  mfByAccount: MfAccountBreakdown[];
  mfByType: MfTypeBreakdown[];
  updatedAt: string;
  accountIssues?: AccountIssue[];
}
