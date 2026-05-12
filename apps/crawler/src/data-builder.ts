import type { ScrapedData } from "@moneyforward-daily-action/db/types";
import type { GlobalData, GroupData } from "./scraper.js";

export function buildScrapedData(globalData: GlobalData, groupData: GroupData): ScrapedData {
  const now = new Date();
  const updatedAt = now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  return {
    summary: groupData.summary,
    items: groupData.items,
    cashFlow: globalData.cashFlow,
    portfolio: globalData.portfolio,
    liabilities: globalData.liabilities,
    assetHistory: groupData.assetHistory,
    registeredAccounts: globalData.registeredAccounts,
    spendingTargets: null,
    currentGroup: groupData.group,
    refreshResult: globalData.refreshResult,
    updatedAt,
  };
}

export function buildGroupOnlyScrapedData(groupData: GroupData): ScrapedData {
  const now = new Date();
  const updatedAt = now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  return {
    summary: groupData.summary,
    items: groupData.items,
    cashFlow: { month: "", totalIncome: 0, totalExpense: 0, balance: 0, items: [] },
    portfolio: { items: [], totalAssets: 0 },
    liabilities: { items: [], totalLiabilities: 0 },
    assetHistory: groupData.assetHistory,
    registeredAccounts: groupData.registeredAccounts,
    spendingTargets: null,
    currentGroup: groupData.group,
    refreshResult: null,
    updatedAt,
  };
}
