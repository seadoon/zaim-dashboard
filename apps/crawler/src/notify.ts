import {
  initDb,
  closeDb,
  getZaimBankTotal,
  getMfSecuritiesTotal,
  getMfSecuritiesAccountIssues,
  getMfSecuritiesDailyChange,
  getMfSecuritiesByAccount,
  getMfSecuritiesByType,
  getDailyAssetChange,
  getCategoryChangesForPeriod,
  getZaimBankHistory,
} from "@moneyforward-daily-action/db";
import path from "node:path";
import { sendDiscordNotification } from "./discord.js";
import { info, error } from "./logger.js";

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "../../../.env"));
} catch {
  // .env file not found (CI environment)
}

async function main() {
  const db = initDb();

  try {
    const zaimBankTotal = getZaimBankTotal(db);
    const mfSecuritiesTotal = getMfSecuritiesTotal(db);
    const dailyAssetChange = getDailyAssetChange(undefined, db);
    const monthlyChanges = getCategoryChangesForPeriod("monthly", undefined, db);
    const zaimHistory = getZaimBankHistory({ limit: 2 }, db);
    const securitiesIssues = getMfSecuritiesAccountIssues(db).map((a) => ({
      name: a.name,
      status: a.status as "updating" | "error",
      errorMessage: a.errorMessage,
    }));

    const now = new Date();
    const updatedAt = now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

    const zaimBankDailyChange =
      zaimHistory.length >= 2 ? zaimHistory[0].total - zaimHistory[1].total : null;

    await sendDiscordNotification({
      totalAssets: zaimBankTotal + mfSecuritiesTotal,
      zaimBankTotal,
      mfSecuritiesTotal,
      dailyChange: dailyAssetChange?.change ?? null,
      monthlyChange: monthlyChanges?.total.change ?? null,
      monthlyChangePrevious: monthlyChanges?.total.previous ?? null,
      zaimBankDailyChange,
      mfSecuritiesDailyChange: getMfSecuritiesDailyChange(db),
      mfByAccount: getMfSecuritiesByAccount(db),
      mfByType: getMfSecuritiesByType(db),
      updatedAt,
      accountIssues: securitiesIssues,
    });

    info("Notification sent!");
  } catch (err) {
    error("Failed to send notification:", err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

void main();
