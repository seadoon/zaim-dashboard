export interface ScrapeOptions {
  skipRefresh?: boolean;
}

export interface AccountIssue {
  name: string;
  status: "updating" | "error";
  errorMessage?: string;
}

export interface NotificationData {
  summary: { totalAssets: string; monthlyChange: string; monthlyChangePercent: string };
  items: { name: string; balance: string; change: string }[];
  updatedAt: string;
  groupName?: string;
  accountIssues?: AccountIssue[];
}
