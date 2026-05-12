import type { SpendingTargetsData } from "@moneyforward-daily-action/db/types";
import type { Page } from "playwright";

export async function getSpendingTargets(_page: Page): Promise<SpendingTargetsData> {
  return { categories: [] };
}
