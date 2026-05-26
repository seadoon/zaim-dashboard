export interface ScrapeOptions {
  skipRefresh?: boolean;
}

export interface AccountIssue {
  name: string;
  status: "updating" | "error";
  errorMessage?: string | null;
}

export interface NotificationData {
  totalAssets: number;
  zaimBankTotal: number;
  mfSecuritiesTotal: number;
  dailyChange: number | null;
  updatedAt: string;
  accountIssues?: AccountIssue[];
}
