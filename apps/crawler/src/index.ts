import {
  initDb,
  closeDb,
  getZaimBankTotal,
  getZaimBankItems,
  getMfSecuritiesTotal,
  getMfSecuritiesAccountIssues,
  getAssetBreakdownByCategory,
  getDailyAssetChange,
} from "@moneyforward-daily-action/db";
import {
  buildAccountIdMap,
  updateAccountCategory,
} from "@moneyforward-daily-action/db/repository/accounts";
import {
  saveScrapedData,
  saveGroupOnlyData,
} from "@moneyforward-daily-action/db/repository/save-scraped-data";
import path from "node:path";
import { chromium } from "playwright";
import { loginWithAuthState } from "./auth/login.js";
import { hasAuthState } from "./auth/state.js";
import { createBrowserContext } from "./browser/context.js";
import { buildScrapedData, buildGroupOnlyScrapedData } from "./data-builder.js";
import { sendDiscordNotification, sendDiscordErrorNotification } from "./discord.js";
import { log, info, error, section, warn } from "./logger.js";
import { scrapeAllGroups } from "./scraper.js";
import { scrapeInstitutionCategories } from "./scrapers/institution-categories.js";
import { isNoGroup, NO_GROUP_ID } from "./scrapers/group.js";

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "../../../.env"));
} catch {
  // .env file not found (CI environment)
}

const isDebug = process.env.DEBUG === "true";
const isHeaded = process.env.HEADED === "true";

async function main() {
  const skipRefresh = process.env.SKIP_REFRESH === "true";
  const authState = hasAuthState() ? "configured" : "none";

  section("Options");
  log(`SKIP_REFRESH: ${skipRefresh}`);
  log(`DEBUG:        ${isDebug}`);
  log(`HEADED:       ${isHeaded}`);
  log(`AUTH_STATE:   ${authState}`);

  section("Setup");
  log("Initializing database");
  const db = initDb();

  const browser = await chromium.launch({ headless: !isHeaded });
  const context = await createBrowserContext(browser, { useAuthState: true });
  const page = await context.newPage();

  try {
    log("Authenticating...");
    await loginWithAuthState(page, context);

    section("Scrape (All Groups)");
    const scrapeResult = await scrapeAllGroups(page, { skipRefresh });
    const { globalData, groupDataList } = scrapeResult;

    info(`Scraped ${groupDataList.length} groups`);

    section("Save");

    const noGroupData = groupDataList.find((gd) => isNoGroup(gd.group.id));
    if (noGroupData) {
      const scrapedData = buildScrapedData(globalData, noGroupData);
      saveScrapedData(db, scrapedData);
    }

    for (const groupData of groupDataList) {
      if (isNoGroup(groupData.group.id)) continue;
      const scrapedData = buildGroupOnlyScrapedData(groupData);
      saveGroupOnlyData(db, scrapedData);
    }

    log("Scraping institution categories...");
    const accountIdMap = buildAccountIdMap(db);
    const categoryMap = await scrapeInstitutionCategories(page);
    log(`Updated ${categoryMap.size} account categories`);
    for (const [mfId, category] of categoryMap.entries()) {
      const accountId = accountIdMap.get(mfId);
      if (accountId !== undefined) {
        updateAccountCategory(db, mfId, category);
      }
    }

    section("Notification");
    try {
      const notifyGroupData = groupDataList.find((gd) => !isNoGroup(gd.group.id)) ?? groupDataList[0];
      if (!notifyGroupData) {
        warn("No data available for notification");
      } else {
        const zaimBankTotal = getZaimBankTotal(db);
        const zaimBankItems = getZaimBankItems(db);
        const mfSecuritiesTotal = getMfSecuritiesTotal(db);
        const mfAssetBreakdown = getAssetBreakdownByCategory(undefined, db);
        const dailyAssetChange = getDailyAssetChange(undefined, db);
        const securitiesIssues = getMfSecuritiesAccountIssues(db).map((a) => ({
          name: a.name,
          status: a.status as "updating" | "error",
          errorMessage: a.errorMessage,
        }));

        const now = new Date();
        const updatedAt = now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

        const notifyPayload = {
          combinedTotal: zaimBankTotal + mfSecuritiesTotal,
          zaimBankTotal,
          mfSecuritiesTotal,
          zaimBankItems,
          mfAssetBreakdown,
          mfDailyChange: dailyAssetChange?.change ?? null,
          monthlyChange: notifyGroupData.summary.monthlyChange,
          monthlyChangePercent: notifyGroupData.summary.monthlyChangePercent,
          updatedAt,
          accountIssues: securitiesIssues,
        };

        await sendDiscordNotification(notifyPayload);
      }
    } catch (err) {
      error("Failed to send notification:", err);
    }

    info("Completed!");
  } catch (err) {
    error("Error occurred:", err);

    if (isDebug) {
      const screenshotPath = `error-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      log(`Screenshot saved to ${screenshotPath}`);
    }

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
