export interface ScrapeOptions {
  skipRefresh?: boolean;
}

export interface AccountIssue {
  name: string;
  status: "updating" | "error";
  errorMessage?: string | null;
}

export interface NotificationData {
  combinedTotal: number;
  zaimBankTotal: number;
  mfSecuritiesTotal: number;
  zaimBankItems: Array<{ name: string; balance: number }>;
  mfSecuritiesItems: Array<{ name: string; balance: number }>;
  dailyChange: number | null;
  monthlyChange: string;
  monthlyChangePercent: string;
  updatedAt: string;
  accountIssues?: AccountIssue[];
}
