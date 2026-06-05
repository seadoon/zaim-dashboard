import {
  initDb,
  closeDb,
  getZaimBankTotal,
  getDailyAssetChange,
  getCategoryChangesForPeriod,
  getZaimBankHistory,
  getRfSecuritiesTotal,
  getRfSecuritiesDailyChange,
  getRfSecuritiesTotalByBroker,
  getRfSecuritiesTotalByType,
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
    const rfSecuritiesTotal = getRfSecuritiesTotal(db);
    const dailyAssetChange = getDailyAssetChange(db);
    const monthlyChanges = getCategoryChangesForPeriod("monthly", db);
    const zaimHistory = getZaimBankHistory({ limit: 2 }, db);

    const now = new Date();
    const updatedAt = now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
    const zaimBankDailyChange =
      zaimHistory.length >= 2 ? zaimHistory[0].total - zaimHistory[1].total : null;

    await sendDiscordNotification({
      totalAssets: zaimBankTotal + rfSecuritiesTotal,
      zaimBankTotal,
      rfSecuritiesTotal,
      dailyChange: dailyAssetChange?.change ?? null,
      monthlyChange: monthlyChanges?.total.change ?? null,
      monthlyChangePrevious: monthlyChanges?.total.previous ?? null,
      zaimBankDailyChange,
      rfSecuritiesDailyChange: getRfSecuritiesDailyChange(db),
      rfByBroker: getRfSecuritiesTotalByBroker(db),
      rfByType: getRfSecuritiesTotalByType(db),
      updatedAt,
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
