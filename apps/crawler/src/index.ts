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
import { saveRobofolioData } from "@moneyforward-daily-action/db";
import path from "node:path";
import { chromium } from "playwright";
import { loginToRobofolio } from "./auth/robofolio-login.js";
import { scrapeHoldings, triggerCrawlIfReady } from "./scrapers/robofolio-holdings.js";
import { backfillAssetHistory } from "./scrapers/robofolio-backfill.js";
import { scrapeNikkoHoldings } from "./scrapers/nikko-holdings.js";
import { sendDiscordNotification, sendDiscordErrorNotification } from "./discord.js";
import { log, info, error, section } from "./logger.js";

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "../../../.env"));
} catch {
  // .env file not found (CI environment)
}

async function main() {
  section("Setup");
  const db = initDb();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    section("Login");
    await loginToRobofolio(page);

    section("Crawl");
    await triggerCrawlIfReady(page);

    section("Scrape");
    const holdings = await scrapeHoldings(page);
    info(`Scraped ${holdings.length} holdings`);

    section("Save");
    const today = new Date().toISOString().slice(0, 10);
    saveRobofolioData(db, holdings, today);

    section("Backfill");
    await backfillAssetHistory(page, db);

    section("Nikko");
    // 日興のサイトは夜間メンテナンス等で失敗しやすい。robofolio分のデータまで
    // 破棄されないよう、失敗しても通知だけ送って処理を続行する。
    try {
      await scrapeNikkoHoldings();
    } catch (err) {
      error("Nikko scraping failed (non-fatal):", err);
      if (err instanceof Error) {
        await sendDiscordErrorNotification(err).catch((notifyErr) => {
          error("Failed to send error notification:", notifyErr);
        });
      }
    }
    log("Data saved to DB");

    section("Notification");
    const zaimBankTotal = getZaimBankTotal(db);
    const rfSecuritiesTotal = getRfSecuritiesTotal(db);
    const dailyAssetChange = getDailyAssetChange(db);
    const monthlyChanges = getCategoryChangesForPeriod("monthly", db);
    const zaimHistory = getZaimBankHistory({ limit: 2 }, db);

    const updatedAt = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
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

    info("Completed!");
  } catch (err) {
    error("Error occurred:", err);

    if (err instanceof Error) {
      try {
        await sendDiscordErrorNotification(err);
      } catch (notifyErr) {
        error("Failed to send error notification:", notifyErr);
      }
    }

    process.exit(1);
  } finally {
    await browser.close();
    closeDb();
  }
}

void main();
