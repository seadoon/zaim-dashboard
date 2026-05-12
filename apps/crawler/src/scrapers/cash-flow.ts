import type { CashFlowSummary } from "@moneyforward-daily-action/db/types";
import type { Page } from "playwright";

export async function getCashFlow(_page: Page): Promise<CashFlowSummary> {
  return { month: "", totalIncome: 0, totalExpense: 0, balance: 0, items: [] };
}
